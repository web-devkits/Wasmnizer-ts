/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */
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
    ExternModuleManager,
    ExternModule,
    ExternType,
    ExternTypeKind,
    ExternItem,
} from '../semantics_nodes.js';

import { ValueType, ObjectType, ValueTypeKind } from '../value_types.js';

import {
    IRModule,
    RuntimeData,
    RuntimeExternModule,
    RuntimeExternItem,
    RuntimeExternModules,
} from './irmodule.js';

export class StatisticsInfo {
    public loadCount = 0;
    public saveCount = 0;
    public newCount = 0;
    public callCount = 0;
}

export enum S {
    LOAD,
    NEW,
    SAVE,
    CALL,
    IMPORT_EXPORT,
}

export type StatisticsObject =
    | VarDeclareNode
    | FunctionDeclareNode
    | ObjectType
    | ObjectDescription
    | Shape;

function buildMapAsArray<T>(map: Map<T, number>): T[] {
    const arr = new Array<T>(map.size);
    map.forEach((idx, t) => {
        arr[idx - 1] = t;
    });
    return arr;
}

export interface ExternItemInfo {
    module: RuntimeExternModule;
    item: RuntimeExternItem;
}

export class GlobalContext {
    // globalVar
    private _globalVars = new Map<VarDeclareNode, number>();

    // globalFunctions
    private _globalFunctions = new Map<FunctionDeclareNode, number>();

    // globalClass (Class & Literal)
    private _globalClasses = new Map<ObjectType, number>();

    // global meta index
    private _globalMetas = new Map<ObjectDescription, number>();

    // global static shape
    private _globalStaticShapes = new Map<Shape, number>();

    // statistics
    private _globalStatiscsInfo = new Map<StatisticsObject, StatisticsInfo>();

    private _imports?: RuntimeExternModules;
    private _exports?: RuntimeExternModules;
    private _importMap = new Map<ExternType, ExternItemInfo>();
    private _exportMap = new Map<ExternType, ExternItemInfo>();

    constructor(public readonly module: IRModule) {
        this.processVars();
        this.processFunctions();
        this.processClasses();
        this.processMetaShapes();
        this.processImportsExports();
    }

    processVars() {
        const vars = this.module.module.globalVars;
        let i = 1; // index start 1
        for (const v of vars) {
            this._globalVars.set(v, i++);
        }
    }

    processFunctions() {
        const funcs = this.module.module.functions;
        let i = 1;
        for (const f of funcs) {
            this._globalFunctions.set(f, i++);
        }
    }

    processClasses() {
        const types = this.module.module.namedTypes;
        let i = 1;
        types.forEach((vt, _) => {
            if (vt.kind == ValueTypeKind.OBJECT) {
                const clazz = vt as ObjectType;
                this._globalClasses.set(clazz, i++);
            }
        });
    }

    processMetaShapes() {
        let meta_idx = 1;
        let shape_idx = 1;
        const metas = this.module.module.objectDescriptions;
        for (const meta of metas) {
            this._globalMetas.set(meta, meta_idx++);
            if (meta.originShape) {
                this._globalStaticShapes.set(meta.originShape, shape_idx++);
            }
            if (meta.thisShape && meta.thisShape !== meta.originShape) {
                this._globalStaticShapes.set(meta.thisShape, shape_idx++);
            }
            meta.compatibleShapes.forEach((s, m) => {
                if (!this._globalStaticShapes.has(s)) {
                    this._globalStaticShapes.set(s, shape_idx++);
                }
            });
        }
    }

    processImportsExports() {
        this._imports = this.buildExternModules(
            this.module.module.imports,
            this._importMap,
        );
        this._exports = this.buildExternModules(
            this.module.module.exports,
            this._exportMap,
        );
    }

    getVarIndex(decl: VarDeclareNode, s: S = S.LOAD): number {
        const idx = this._globalVars.get(decl);
        if (!idx) {
            throw Error(`global ${decl} is not exist`);
        }

        this.updateStatistics(decl, s);
        return idx! - 1;
    }

    getFunctionIndex(func: FunctionDeclareNode, s: S = S.CALL): number {
        const idx = this._globalFunctions.get(func);
        if (!idx) {
            throw Error(`global function ${func} is not exist`);
        }
        this.updateStatistics(func, s);
        return idx! - 1;
    }

    getClassIndex(clazz: ObjectType, s: S = S.NEW): number {
        const idx = this._globalClasses.get(clazz);
        if (!idx) throw Error(`global class ${clazz} is not exist`);
        this.updateStatistics(clazz, s);
        return idx! - 1;
    }

    getMetaIndex(meta: ObjectDescription): number {
        const idx = this._globalMetas.get(meta);
        if (!idx) throw Error(`global meta ${meta.name} is not exist`);
        this.updateStatistics(meta, S.LOAD);
        return idx! - 1;
    }

    getShapeIndex(shape: Shape): number {
        const idx = this._globalStaticShapes.get(shape.genericShape);
        if (!idx) throw Error(`global shape ${shape.meta.name} is not exist`);
        this.updateStatistics(shape, S.LOAD);
        return idx! - 1;
    }

    getImportInfo(type: ExternType): ExternItemInfo | undefined {
        return this._importMap.get(type);
    }

    updateStatistics(key: StatisticsObject, s: S) {
        let info = this._globalStatiscsInfo.get(key);
        if (!info) {
            info = new StatisticsInfo();
            this._globalStatiscsInfo.set(key, info!);
        }

        switch (s) {
            case S.LOAD:
                info!.loadCount++;
                break;
            case S.SAVE:
                info!.saveCount++;
                break;
            case S.NEW:
                info!.newCount++;
                break;
            case S.CALL:
                info!.callCount++;
                break;
        }
    }

    finishBuild() {
        this.buildRuntimeData();
    }

    private buildRuntimeData() {
        this.module.runtimeData = new RuntimeData(
            this.module.dataPool,
            buildMapAsArray(this._globalVars),
            buildMapAsArray(this._globalFunctions),
            buildMapAsArray(this._globalClasses),
            buildMapAsArray(this._globalMetas),
            buildMapAsArray(this._globalStaticShapes),
            this._globalStatiscsInfo,
            this._imports!,
            this._exports!,
        );
        this.module.runtimeData!.build(this);
    }

    private buildExternModules(
        mod_mgr: ExternModuleManager,
        modMap: Map<ExternType, ExternItemInfo>,
    ): RuntimeExternModules {
        const dataPool = this.module.dataPool;
        const extern_modules: RuntimeExternModule[] = [];
        for (const mod of mod_mgr.modules) {
            const items: RuntimeExternItem[] = [];
            const module = new RuntimeExternModule(
                dataPool.addString(mod.name),
                items,
                extern_modules.length,
            );
            for (const it of mod.items) {
                const item = new RuntimeExternItem(
                    dataPool.addString(it.name),
                    it.kind,
                    this.findExternItemIndex(it.kind, it.type),
                    items.length,
                );
                items.push(item);
                modMap.set(it.type, { module, item });
            }
            extern_modules.push(module);
        }

        return new RuntimeExternModules(extern_modules);
    }

    private findExternItemIndex(
        kind: ExternTypeKind,
        type: ExternType,
    ): number {
        switch (kind) {
            case ExternTypeKind.FUNCTION:
                return this.getFunctionIndex(
                    type as FunctionDeclareNode,
                    S.IMPORT_EXPORT,
                );
            case ExternTypeKind.CLASS:
                return this.getClassIndex(
                    (type as ObjectType).instanceType!,
                    S.IMPORT_EXPORT,
                );
            case ExternTypeKind.VAR:
                return this.getVarIndex(
                    type as VarDeclareNode,
                    S.IMPORT_EXPORT,
                );
            case ExternTypeKind.ENUM:
                // TODO get enum reflection index
                return -1;
        }
        return -1;
    }
}
