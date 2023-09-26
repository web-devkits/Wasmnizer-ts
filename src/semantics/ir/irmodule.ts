/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { IRFunction } from './function.js';

import { DataPool } from './data_pool.js';

import { Logger } from '../../log.js';

import {
    MemberType,
    ObjectDescription,
    ObjectDescriptionType,
    MemberDescription,
    ShapeAccessor,
    Shape,
    ShapeMember,
    ShapeMethod,
    ShapeField,
    Value,
} from '../runtime.js';

import {
    SemanticsKind,
    SemanticsNode,
    ModuleNode,
    FunctionDeclareNode,
    VarDeclareNode,
    BlockNode,
    BasicBlockNode,
    IfNode,
    ForNode,
    ForInNode,
    ForOfNode,
    WhileNode,
    ReturnNode,
} from '../semantics_nodes.js';

import {
    SemanticsValue,
    SemanticsValueKind,
    VarValue,
    LiteralValue,
    BinaryExprValue,
    FunctionCallValue,
    ConditionExprValue,
    ElementGetValue,
    ElementSetValue,
    CastValue,
} from '../value.js';

import { ValueType, ValueTypeKind, ObjectType } from '../value_types.js';

import {
    GlobalContext,
    S,
    StatisticsObject,
    StatisticsInfo,
} from './ir_context.js';

export class MemberDescriptionInfo {
    nameOffset = 0;
    type = 0;
    index = 0;
}

export class ObjectDescriptionInfo {
    name = '';
    offset = 0; // the offset in data pool
    nameOffset = 0; // the name offset
    base?: ObjectDescriptionInfo;
    flags = 0; // int32
    members: MemberDescriptionInfo[] = [];
}

enum ShapeMemberType {
    METHOD = 0,
    OFFSET, // 1
    ACCESSOR, // 2
    ACCESSOR_OFFSET, //3
}

interface ShapeMemberParam {
    offset?: number;
    method?: number;
    getter?: number;
    setter?: number;
}

export class ShapeMemberInfo {
    private _value = 0;

    constructor(type: ShapeMemberType, param?: ShapeMemberParam) {
        let value = 0;
        if (param) {
            if (
                type == ShapeMemberType.METHOD ||
                type == ShapeMemberType.OFFSET
            ) {
                if (param.offset || param.method) {
                    value = (param.offset ? param.offset! : param.method!) + 1;
                }
            } else if (
                type == ShapeMemberType.ACCESSOR ||
                type == ShapeMemberType.ACCESSOR_OFFSET
            ) {
                if (param.getter || param.setter) {
                    const getter = param.getter ? param.getter! + 1 : 0;
                    const setter = param.setter ? param.setter! + 1 : 0;
                    value = (getter & 0x7fff) | ((setter & 0x7fff) << 15);
                }
            }
        }

        this._value = (value << 2) | (type & 3);
    }

    get type(): ShapeMemberType {
        return this._value & 3;
    }

    get offset(): number {
        return this._value >> 2;
    }

    get method(): number {
        return this._value >> 2;
    }

    get getter(): number {
        return (this._value >> 2) & 0x7fff;
    }

    get setter(): number {
        return (this._value >> 17) & 0x7fff;
    }

    get value(): number {
        return this._value;
    }
}

export class ShapeInfo {
    name = '';
    offset = 0;
    metaOffset = 0; // meta offset
    members: ShapeMemberInfo[] = [];
}

function createObjectDescriptionName(od: ObjectDescription): string {
    switch (od.type) {
        case ObjectDescriptionType.OBJECT_LITERAL:
            return `${od.name}_literal`;
        case ObjectDescriptionType.INTERFACE:
            return `${od.name}_interface`;
        case ObjectDescriptionType.OBJECT_INSTANCE:
            return `${od.name}_instance`;
        case ObjectDescriptionType.OBJECT_CLASS:
            return `${od.name}_class`;
    }
}

export class RuntimeExternItem {
    constructor(
        public readonly nameOffset: number,
        public readonly type: number, // ExternTypeKind
        public readonly index: number, // index in the functions, vars, class, enums array
        public readonly externIndex: number, // the index in import/export module
    ) {}
}

export class RuntimeExternModule {
    constructor(
        public readonly nameOffset: number,
        public readonly items: RuntimeExternItem[],
        public readonly externIndex: number, // the index in import/export table
    ) {}
}

export class RuntimeExternModules {
    public offset = 0;
    constructor(public readonly modules: RuntimeExternModule[]) {}
}

enum BlockHeaderType {
    STRING_POOL,
    METAS,
    SHAPS,
    IMPORTS,
    EXPORTS,
}

class BlockHeader {
    count = 0;
    size = 0;

    constructor(public readonly type: BlockHeaderType) {}

    write(dataPool: DataPool) {
        dataPool.addInt32(
            ((this.type << 28) & 0xf0000000) | (this.count & 0x0fffffff),
        );
        dataPool.addInt32(this.size);
    }

    update(dataPool: DataPool, start: number) {
        dataPool.setInt32(
            start,
            ((this.type << 28) & 0xf0000000) | (this.count & 0x0fffffff),
        );
        dataPool.setInt32(start + 4, this.size);
    }
}

export class RuntimeData {
    private stringBlock = new BlockHeader(BlockHeaderType.STRING_POOL);
    private metaBlock = new BlockHeader(BlockHeaderType.METAS);
    private shapeBlock = new BlockHeader(BlockHeaderType.SHAPS);
    private importBlock = new BlockHeader(BlockHeaderType.IMPORTS);
    private exportBlock = new BlockHeader(BlockHeaderType.EXPORTS);

    constructor(
        public readonly dataPool: DataPool,
        public readonly globalVars: VarDeclareNode[],
        public readonly functions: FunctionDeclareNode[],
        public readonly classes: ObjectType[],
        public readonly metas: ObjectDescription[],
        public readonly shapes: Shape[],
        public readonly staticsInfos: Map<StatisticsObject, StatisticsInfo>,
        public readonly imports: RuntimeExternModules,
        public readonly exports: RuntimeExternModules,
    ) {}

    build(context: GlobalContext) {
        this.buildObjectDescriptions();
        this.buildShapes(context);
        this.buildExterns(context, this.imports, this.importBlock, true);
        this.buildExterns(context, this.exports, this.exportBlock, false);
    }

    public objectDescriptionsMap = new Map<
        ObjectDescription,
        ObjectDescriptionInfo
    >();
    public shapesMap = new Map<Shape, ShapeInfo>();

    buildObjectDescriptions() {
        this.metaBlock.write(this.dataPool);
        const start = this.dataPool.getCurrentSize();
        for (const od of this.metas) {
            const info = this.buildObjectDescription(od);
            this.objectDescriptionsMap.set(od, info);
        }
        this.metaBlock.count = this.objectDescriptionsMap.size;
        this.metaBlock.size = this.dataPool.getCurrentSize() - start;
        this.metaBlock.update(this.dataPool, start - 8);
    }

    buildObjectDescription(od: ObjectDescription): ObjectDescriptionInfo {
        if (this.objectDescriptionsMap.has(od))
            return this.objectDescriptionsMap.get(od)!;

        let base_info: ObjectDescriptionInfo | undefined = undefined;
        const base = od.base;
        if (base) {
            base_info = this.buildObjectDescription(base);
        }

        const name = createObjectDescriptionName(od);
        const info = new ObjectDescriptionInfo();
        info.nameOffset = this.dataPool.addString(od.name);
        info.name = name;
        info.base = base_info;
        info.flags = od.type;

        Logger.debug(`=== build ObjectDescription ${name}`);

        // add the name of members
        for (const m of od.members) {
            const minfo = new MemberDescriptionInfo();
            minfo.nameOffset = this.dataPool.addString(m.name);
            minfo.type = m.type;
            minfo.index = m.index;
            info.members.push(minfo);
        }

        info.offset = this.dataPool.getCurrentSize();
        this.dataPool.addInt32(info.nameOffset);
        this.dataPool.addInt32(base_info ? base_info.offset : 0);
        this.dataPool.addInt32(info.flags);
        this.dataPool.addInt32(info.members.length);

        for (let i = 0; i < info.members.length; i++) {
            const m = info.members[i];
            this.dataPool.addInt32(m.nameOffset);
            this.dataPool.addInt32((m.type << 16) | (m.index & 0xffff));
        }

        return info;
    }

    buildShapes(context: GlobalContext) {
        this.shapeBlock.write(this.dataPool);
        const start = this.dataPool.getCurrentSize();
        let count = 0;
        for (const od of this.metas) {
            if (od.originShape) {
                this.buildShape(od.originShape, 'origin', context);
                count++;
            }
            if (od.thisShape) {
                this.buildShape(od.thisShape, 'this', context);
                count++;
            }

            let idx = 0;
            od.compatibleShapes.forEach((shape, od) => {
                this.buildShape(shape, `comp_${idx++}`, context), count++;
            });
        }
        this.shapeBlock.count = count;
        this.shapeBlock.size = this.dataPool.getCurrentSize() - start;
        this.shapeBlock.update(this.dataPool, start - 8);
    }

    buildShape(shape: Shape, suffix: string, context: GlobalContext) {
        const meta_info = this.objectDescriptionsMap.get(shape.meta)!;
        const info = new ShapeInfo();
        info.name = `${meta_info.name}_${suffix}`;
        info.metaOffset = meta_info.offset;
        Logger.debug(`=== build Shape ${info.name} members: ${shape.members}`);
        if (shape.members) {
            for (const m of shape.members) {
                if (m) {
                    const param: ShapeMemberParam = {};
                    let type: ShapeMemberType = ShapeMemberType.OFFSET;
                    switch (m.kind) {
                        case MemberType.FIELD:
                            type = ShapeMemberType.OFFSET;
                            param.offset = (m as ShapeField).offset;
                            break;
                        case MemberType.ACCESSOR:
                            type = ShapeMemberType.ACCESSOR;
                            createAccessorInfo(
                                m as ShapeAccessor,
                                param,
                                context,
                            );
                            break;
                        case MemberType.METHOD:
                            if (m.isOffset) {
                                type = ShapeMemberType.OFFSET;
                                param.offset = (m as ShapeMethod).methodOffset;
                            } else {
                                type = ShapeMemberType.METHOD;
                                param.method = getShapeValueIndex(
                                    (m as ShapeMethod).methodValue,
                                    context,
                                );
                            }
                            break;
                    }
                    info.members.push(new ShapeMemberInfo(type, param));
                } else {
                    info.members.push(new ShapeMemberInfo(0));
                }
            }
        }

        this.saveShape(info);
        this.shapesMap.set(shape, info);
    }

    saveShape(info: ShapeInfo) {
        const dataPool = this.dataPool;
        info.offset = dataPool.getCurrentSize();
        dataPool.addInt32(info.metaOffset);
        dataPool.addInt32(info.members.length);
        for (const m of info.members) {
            dataPool.addInt32(m.value);
        }
    }

    buildExterns(
        context: GlobalContext,
        modules: RuntimeExternModules,
        block: BlockHeader,
        isImports: boolean,
    ) {
        block.write(this.dataPool);
        const start = this.dataPool.getCurrentSize();
        modules.offset = start;
        for (const m of modules.modules) {
            this.dataPool.addInt32(m.nameOffset);
            this.dataPool.addInt32(
                m.items.length | (isImports ? 0x80000000 : 0),
            );
            for (const i of m.items) {
                this.dataPool.addInt32(i.nameOffset);
                this.dataPool.addInt32(
                    ((i.type & 0xf) << 28) | (i.index & 0x7fffffff),
                );
            }
        }
        block.count = modules.modules.length;
        block.size = this.dataPool.getCurrentSize() - start;
        block.update(this.dataPool, start - 8);
    }
}

function createAccessorInfo(
    shape_acc: ShapeAccessor,
    param: ShapeMemberParam,
    context: GlobalContext,
) {
    if (shape_acc.isOffset) {
        param.getter = shape_acc.getterOffset;
        param.setter = shape_acc.setterOffset;
    } else {
        param.getter = getShapeValueIndex(shape_acc.getterValue, context);
        param.setter = getShapeValueIndex(shape_acc.setterValue, context);
    }
}

function getShapeValueIndex(
    value: Value | undefined,
    context: GlobalContext,
): number | undefined {
    if (!value || !(value instanceof VarValue)) return undefined;

    const var_value = value! as VarValue;
    if (!(var_value.ref instanceof FunctionDeclareNode)) return undefined;

    return context.getFunctionIndex(
        var_value.ref as FunctionDeclareNode,
        S.CALL,
    );
}

export class IRModule {
    public functions: IRFunction[] = [];
    public dataPool = new DataPool();
    public runtimeData?: RuntimeData;

    constructor(public module: ModuleNode) {
        const block = new BlockHeader(BlockHeaderType.STRING_POOL);
        block.write(this.dataPool);
        collectionStrings(module, this.dataPool);
        this.build();
    }

    private build() {
        const context = new GlobalContext(this);
        const block = new BlockHeader(BlockHeaderType.STRING_POOL);
        block.count = this.dataPool.getStringCount();
        block.size = this.dataPool.getCurrentSize();
        block.update(this.dataPool, 0); // update string

        this.buildFunctions(context);
        context.finishBuild();
    }

    private buildFunctions(context: GlobalContext) {
        for (const f of this.module.functions) {
            this.buildFunction(f, context);
        }
    }

    private buildFunction(f: FunctionDeclareNode, context: GlobalContext) {
        const bcfunc = new IRFunction(this);
        bcfunc.build(f, context);
        this.functions.push(bcfunc);
    }
}

function processValueString(value: SemanticsValue, dataPool: DataPool) {
    if (value.kind == SemanticsValueKind.LITERAL) {
        if (value.type.kind == ValueTypeKind.RAW_STRING) {
            dataPool.addString((value as LiteralValue).value as string);
        }
    }

    value.forEachChild((v) => processValueString(v, dataPool));
}

function collectionStrings(module: ModuleNode, dataPool: DataPool) {
    module.functions.forEach((f) => {
        dataPool.addString(f.name);
        f.forEachValue((v) => processValueString(v, dataPool));
    });
}
