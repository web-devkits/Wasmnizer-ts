/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { DumpWriter, CreateDefaultDumpWriter } from './dump.js';
import { MemberType, ObjectDescription, Shape } from './runtime.js';

import {
    SemanticsValue,
    SemanticsValueVisitor,
    VarValue,
    LiteralValue,
    SemanticsValueKind,
} from './value.js';

import { Logger } from '../log.js';

import {
    Type,
    TSClass,
    TsClassField,
    TsClassFunc,
    FunctionKind,
    TypeKind,
    TSFunction,
    TSArray,
} from '../type.js';

import {
    ValueType,
    ValueTypeKind,
    PrimitiveType,
    Primitive,
    ArrayType,
    SetType,
    MapType,
    UnionType,
    FunctionType,
    EnumType,
    ObjectType,
    WASM,
} from './value_types.js';

import { GetPredefinedType } from './predefined_types.js';
import { PredefinedTypeId, SourceLocation } from '../utils.js';

export enum SemanticsKind {
    EMPTY,
    BASIC_BLOCK,
    MODULE,
    FUNCTION,
    VAR_DECLARE,
    BLOCK,
    IF,
    RETURN,
    FOR,
    FOR_IN,
    FOR_OF,
    WHILE,
    DOWHILE,
    SWITCH,
    CASE_CLAUSE,
    DEFAULT_CLAUSE,
    BREAK,
    CONTINUE,
    TRY,
    CATCH_CLAUSE,
    THROW,
}

export interface SemanticsNodeVisitor {
    (node: SemanticsNode): void;
}

export class SemanticsNode {
    constructor(public kind: SemanticsKind) {}
    location: SourceLocation | null = null;
    dump(writer: DumpWriter) {
        writer.write(SemanticsKind[this.kind]);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        return;
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        this.forEachChild((node) => node.forEachValue(visitor));
    }
}

export class EmptyNode extends SemanticsNode {
    constructor() {
        super(SemanticsKind.EMPTY);
    }
}

export class ReturnNode extends SemanticsNode {
    constructor(public expr: SemanticsValue | undefined) {
        super(SemanticsKind.RETURN);
    }

    dump(writer: DumpWriter) {
        writer.write('[RETURN]');
        writer.shift();
        if (this.expr) this.expr.dump(writer);
        writer.unshift();
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        if (this.expr) visitor(this.expr);
        super.forEachValue(visitor);
    }
}

export type VarStorageType =
    | SemanticsValueKind.LOCAL_VAR
    | SemanticsValueKind.LOCAL_CONST
    | SemanticsValueKind.GLOBAL_VAR
    | SemanticsValueKind.GLOBAL_CONST
    | SemanticsValueKind.PARAM_VAR
    | SemanticsValueKind.CLOSURE_VAR
    | SemanticsValueKind.CLOSURE_CONST;

export enum ParameterNodeFlag {
    OPTIONAL,
}

enum VarDeclareNodeFlag {
    NOT_USED_IN_CLOSURE = 0,
    USED_IN_CLOSURE_BY_REF,
    USED_IN_CLOSURE_BY_VALUE,
    IMPORT_AS_REF = 8,
}

export class VarDeclareNode extends SemanticsNode {
    /** which context use this variable */
    public curCtx?: VarDeclareNode;
    constructor(
        public storageType: VarStorageType,
        public type: ValueType,
        public name: string,
        public index: number,
        public flags: number,
        public initValue?: SemanticsValue,
        public closureIndex?: number,
        public belongCtx?: VarDeclareNode,
        public initCtx?: VarDeclareNode,
        public needReBinding = false,
    ) {
        super(SemanticsKind.VAR_DECLARE);
        this.curCtx = this.belongCtx;
    }

    copy() {
        const newVar = new VarDeclareNode(
            this.storageType,
            this.type,
            this.name,
            this.index,
            this.flags,
            this.initValue,
            this.closureIndex,
            this.belongCtx,
            this.initCtx,
            this.needReBinding,
        );
        return newVar;
    }

    setUsedByClosureFunction() {
        if (
            this.storageType == SemanticsValueKind.LOCAL_VAR ||
            this.storageType == SemanticsValueKind.PARAM_VAR ||
            this.storageType == SemanticsValueKind.CLOSURE_VAR
        )
            this.flags =
                (this.flags & ~3) | VarDeclareNodeFlag.USED_IN_CLOSURE_BY_REF;
        else if (
            this.storageType == SemanticsValueKind.LOCAL_CONST ||
            this.storageType == SemanticsValueKind.CLOSURE_CONST
        )
            this.flags =
                (this.flags & ~3) | VarDeclareNodeFlag.USED_IN_CLOSURE_BY_VALUE;
    }

    isUsedInClosureFunction() {
        return (this.flags & 3) != 0;
    }

    isUsedInClosureByRef(): boolean {
        return (this.flags & 3) == VarDeclareNodeFlag.USED_IN_CLOSURE_BY_REF;
    }

    isUsedInClosureByValue(): boolean {
        return (this.flags & 3) == VarDeclareNodeFlag.USED_IN_CLOSURE_BY_VALUE;
    }

    setImportAsRef() {
        this.flags |= VarDeclareNodeFlag.IMPORT_AS_REF;
    }

    isImportAsRef(): boolean {
        return (
            (this.flags & VarDeclareNodeFlag.IMPORT_AS_REF) ==
            VarDeclareNodeFlag.IMPORT_AS_REF
        );
    }

    isRef(): boolean {
        return this.isUsedInClosureFunction() || this.isImportAsRef();
    }

    toString(): string {
        return `Var ${this.name} ${SemanticsValueKind[this.storageType]} ${
            this.type
        } ${this.index} ${this.flags}`;
    }
    dump(writer: DumpWriter) {
        writer.write(this.toString());
    }
}

export enum FunctionOwnKind {
    STATIC = 1,
    METHOD = 2,
    DEFAULT = 4,
    DECLARE = 8,
    DECORATOR = 16,
    EXPORT = 32,
    START = 64,
}

export class FunctionDeclareNode extends SemanticsNode {
    public flattenValue?: SemanticsValue;
    private _closureVars?: VarDeclareNode[];
    public isInEnterScope = false;
    public importStartFuncNameList: string[] | undefined = undefined;
    public debugFilePath = '';
    constructor(
        public name: string,
        public ownKind: FunctionOwnKind,
        public funcType: FunctionType,
        public body: BlockNode,
        public parameters?: VarDeclareNode[],
        public varList?: VarDeclareNode[],
        public parentCtx?: VarDeclareNode /* closureContext of the parent closureEnvironment scope */,
        private _thisClassType?: ObjectType,
    ) {
        super(SemanticsKind.FUNCTION);
    }

    toString(): string {
        return `FUNCTION: ${this.name} ${FunctionOwnKind[this.ownKind]} ${
            this.funcType
        }`;
    }

    pushClosureVarDeclare(val: VarDeclareNode) {
        if (!this._closureVars) this._closureVars = [];
        this._closureVars!.push(val);
    }

    get thisClassType(): ObjectType | undefined {
        return this._thisClassType;
    }

    get closureVars(): VarDeclareNode[] | undefined {
        return this._closureVars;
    }

    findClosureIndex(v: VarDeclareNode): number {
        if (!this._closureVars) return -1;
        for (let i = 0; i < this._closureVars!.length; i++) {
            const c = this._closureVars![i];
            if (c === v || c.name == v.name) return i;
        }
        return -1;
    }

    findParameterIndex(v: VarDeclareNode): number {
        if (!this.parameters) return -1;
        for (let i = 0; i < this.parameters!.length; i++) {
            const p = this.parameters![i];
            if (p === v || p.name == v.name) return i;
        }
        return -1;
    }

    dump(writer: DumpWriter) {
        writer.write(this.toString());
    }

    dumpCode(writer: DumpWriter) {
        this.dump(writer);
        console.log('function parameters: ');
        console.log(this.parameters);
        this.parameters?.forEach((p) => console.log(p.type));
        console.log('function vars: ');
        console.log(this.varList);
        this.varList?.forEach((v) => console.log(v.type));
        writer.shift();
        this.body.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.varList) this.varList.forEach((n) => visitor(n));
        if (this.parameters) this.parameters.forEach((n) => visitor(n));
        visitor(this.body);
    }
}

export class BlockNode extends SemanticsNode {
    constructor(
        public statements: SemanticsNode[],
        public varList?: VarDeclareNode[],
    ) {
        super(SemanticsKind.BLOCK);
    }

    dump(writer: DumpWriter) {
        if (this.varList) {
            for (const v of this.varList) v.dump(writer);
            writer.write(''); // empty line
        }

        for (const s of this.statements) s.dump(writer);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        this.statements.forEach((n) => visitor(n));
        if (this.varList) this.varList.forEach((n) => visitor(n));
    }
}

export class BasicBlockNode extends SemanticsNode {
    public isStartBasicBlock = false;
    constructor() {
        super(SemanticsKind.BASIC_BLOCK);
    }

    public valueNodes: SemanticsValue[] = [];

    pushSemanticsValue(valueNode: SemanticsValue) {
        this.valueNodes.push(valueNode);
    }

    dump(writer: DumpWriter) {
        super.dump(writer);
        writer.write('BASIC_BLOCK_WRITER');
        writer.write(this.valueNodes.toString());
        writer.write(this.valueNodes.length.toString());
        writer.shift();
        for (const v of this.valueNodes) v.dump(writer);
        writer.unshift();
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        this.valueNodes.forEach((v) => visitor(v));
    }
}

export class IfNode extends SemanticsNode {
    constructor(
        public condition: SemanticsValue,
        public trueNode: SemanticsNode,
        public falseNode?: SemanticsNode,
    ) {
        super(SemanticsKind.IF);
    }

    dump(writer: DumpWriter) {
        writer.write('[IF]');
        writer.shift();
        this.condition.dump(writer);
        this.trueNode.dump(writer);
        writer.unshift();
        if (this.falseNode) {
            writer.write('[ELSE]');
            writer.shift();
            this.falseNode.dump(writer);
            writer.unshift();
        }
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        visitor(this.trueNode);
        if (this.falseNode) visitor(this.falseNode);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.condition);
        super.forEachValue(visitor);
    }
}

export class ForNode extends SemanticsNode {
    constructor(
        public label: string,
        public blockLabel: string,
        public varList?: VarDeclareNode[],
        public initialize?: SemanticsNode,
        public condition?: SemanticsValue,
        public next?: SemanticsValue,
        public body?: SemanticsNode,
    ) {
        super(SemanticsKind.FOR);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.varList) this.varList.forEach((n) => visitor(n));
        if (this.initialize) visitor(this.initialize);
        if (this.body) visitor(this.body);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        if (this.condition) visitor(this.condition);
        super.forEachValue(visitor);
    }

    dump(writer: DumpWriter) {
        writer.write('[FOR]');
        writer.shift();
        if (this.varList)
            for (const v of this.varList) {
                v.dump(writer);
            }
        if (this.initialize) this.initialize.dump(writer);
        if (this.condition) this.condition.dump(writer);
        if (this.next) this.next.dump(writer);
        if (this.body) this.body.dump(writer);
        writer.unshift();
    }
}

export class ForInNode extends SemanticsNode {
    constructor(
        public key: VarDeclareNode,
        public target: VarValue,
        public body?: SemanticsNode,
    ) {
        super(SemanticsKind.FOR_IN);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        visitor(this.key);
        if (this.body) visitor(this.body);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.target);
        super.forEachValue(visitor);
    }
}

export class ForOfNode extends SemanticsNode {
    constructor(
        public value: VarDeclareNode,
        public target: VarValue,
        public body?: SemanticsNode,
    ) {
        super(SemanticsKind.FOR_OF);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.body) visitor(this.body);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.target);
        super.forEachValue(visitor);
    }
}

export type ForInOrOfNode = ForInNode | ForOfNode;

export class WhileNode extends SemanticsNode {
    constructor(
        kind: SemanticsKind.WHILE | SemanticsKind.DOWHILE,
        public label: string,
        public blockLabel: string,
        public condition: SemanticsValue,
        public body?: SemanticsNode,
    ) {
        super(kind);
    }

    isDoWhile(): boolean {
        return this.kind == SemanticsKind.DOWHILE;
    }

    dump(writer: DumpWriter) {
        if (this.isDoWhile()) writer.write('[DO-WHILE]');
        else writer.write('[WHILE]');
        writer.shift();
        this.condition.dump(writer);
        if (this.body) this.body.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.body) visitor(this.body);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.condition);
        super.forEachValue(visitor);
    }
}

export class SwitchNode extends SemanticsNode {
    constructor(
        public label: string,
        public breakLabel: string,
        public condition: SemanticsValue,
        public caseClause: CaseClauseNode[],
        public defaultClause?: DefaultClauseNode,
    ) {
        super(SemanticsKind.SWITCH);
    }

    dump(writer: DumpWriter) {
        writer.write('[SWITCH]');
        writer.shift();
        for (const c of this.caseClause) c.dump(writer);
        if (this.defaultClause) this.defaultClause.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        this.caseClause.forEach((n) => visitor(n));
        if (this.defaultClause) visitor(this.defaultClause);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.condition);
        super.forEachValue(visitor);
    }
}

export class CaseClauseNode extends SemanticsNode {
    constructor(public caseVar: SemanticsValue, public body?: SemanticsNode) {
        super(SemanticsKind.CASE_CLAUSE);
    }

    dump(writer: DumpWriter) {
        writer.write('[CASE]');
        this.caseVar.dump(writer);
        if (this.body) this.body.dump(writer);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.body) visitor(this.body);
    }

    forEachValue(visitor: SemanticsValueVisitor) {
        visitor(this.caseVar);
        super.forEachValue(visitor);
    }
}

export class DefaultClauseNode extends SemanticsNode {
    constructor(public body?: SemanticsNode) {
        super(SemanticsKind.DEFAULT_CLAUSE);
    }
    dump(writer: DumpWriter) {
        writer.write('[DEFAULT]');
        if (this.body) this.body.dump(writer);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        if (this.body) visitor(this.body);
    }
}

export class BreakNode extends SemanticsNode {
    constructor(public label: string) {
        super(SemanticsKind.BREAK);
    }
}

export class ContinueNode extends SemanticsNode {
    constructor() {
        super(SemanticsKind.CONTINUE);
    }
}

export class ThrowNode extends SemanticsNode {
    constructor(public throwExpr: SemanticsValue) {
        super(SemanticsKind.THROW);
    }

    dump(writer: DumpWriter) {
        writer.write('[THROW]');
        this.throwExpr.dump(writer);
    }
}

export class CatchClauseNode extends SemanticsNode {
    public catchVar: SemanticsValue | undefined = undefined;
    constructor(public body: SemanticsNode) {
        super(SemanticsKind.CATCH_CLAUSE);
    }

    dump(writer: DumpWriter) {
        writer.write('[CATCH]');
        if (this.catchVar) {
            this.catchVar.dump(writer);
        }
        this.body.dump(writer);
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        visitor(this.body);
    }
}

export class TryNode extends SemanticsNode {
    constructor(
        public label: string,
        public body: SemanticsNode,
        public catchClause?: CatchClauseNode,
        public finallyBlock?: SemanticsNode,
    ) {
        super(SemanticsKind.TRY);
    }

    dump(writer: DumpWriter) {
        writer.write('[TRY]');
        this.body.dump(writer);
        if (this.catchClause) {
            this.catchClause.dump(writer);
        }
        if (this.finallyBlock) {
            writer.write('[FINALLY]');
            this.finallyBlock.dump(writer);
        }
    }

    forEachChild(visitor: SemanticsNodeVisitor) {
        visitor(this.body);
        if (this.catchClause) visitor(this.catchClause);
        if (this.finallyBlock) visitor(this.finallyBlock);
    }
}

export type ExternType =
    | FunctionDeclareNode
    | VarDeclareNode
    | EnumType
    | ObjectType;
export enum ExternTypeKind {
    FUNCTION,
    CLASS,
    VAR,
    ENUM,
}

export interface ExternItem {
    readonly kind: ExternTypeKind;
    readonly name: string;
    type: ExternType;
}

export class ExternModule {
    public readonly items = new Set<ExternItem>();
    constructor(
        public readonly name: string,
        public readonly isImport = true,
    ) {}

    addItem(kind: ExternTypeKind, name: string, type: ExternType) {
        this.items.add({ kind, name, type });
    }
}

export class ExternModuleManager {
    public readonly modules = new Set<ExternModule>();

    constructor(public readonly isImport = true) {}

    add(m: ExternModule) {
        this.modules.add(m);
    }
}

export class ModuleNode extends SemanticsNode {
    public types: Map<Type, ValueType> = new Map();
    public typeByIds: Map<number, ValueType> = new Map();
    public enums: Map<string, EnumType> = new Map();
    public globalVars: VarDeclareNode[] = [];

    public functions = new Set<FunctionDeclareNode>();
    public globalInitFunc: FunctionDeclareNode | undefined = undefined;
    public globalValues: VarValue[] = [];
    public objectDescriptions: ObjectDescription[] = [];
    public namedTypes = new Map<string, ValueType>(); // save the named object type
    public recObjectTypeGroup = new Array<ObjectType[]>();
    public readonly exports = new ExternModuleManager(false);
    public readonly imports = new ExternModuleManager(true);

    constructor() {
        super(SemanticsKind.MODULE);
    }

    dumpGlobalVars(writer: DumpWriter) {
        for (const v of this.globalVars) v.dump(writer);
    }

    dumpFunctions(writer: DumpWriter) {
        for (const f of this.functions) f.dump(writer);
    }

    dumpTypes(writer: DumpWriter) {
        writer.write('types: {');
        writer.shift();

        this.types.forEach((v, _) => {
            writer.write(v.toString());
        });

        writer.unshift();
        writer.write('}');
    }

    dumpEnums(writer: DumpWriter) {
        writer.write('enums: {');
        writer.shift();
        this.enums.forEach((v, k) => writer.write(v.toString()));
        writer.unshift();
        writer.write('}');
    }

    dump(writer: DumpWriter) {
        writer.write('ModuleNode [');
        writer.shift();

        this.dumpTypes(writer);
        this.dumpGlobalVars(writer);
        this.dumpFunctions(writer);
        this.dumpEnums(writer);
        this.dumpObjectDescriptions(writer);

        writer.unshift();
        writer.write(']');

        writer.unshift();
        writer.write(']');
    }

    dumpObjectDescriptions(writer: DumpWriter) {
        writer.write(`====================== object descripts ===========`);
        for (const od of this.objectDescriptions) od.dump(writer);
        writer.write(`===================================================`);
    }

    dumpCodeTrees(writer: DumpWriter) {
        for (const f of this.functions) {
            f.dumpCode(writer);
            writer.write('');
        }
    }

    findValueTypeByType(type: Type): ValueType | undefined {
        if (type == undefined || type == null) return Primitive.Any;

        switch (type.kind) {
            case TypeKind.VOID:
                return Primitive.Void;
            case TypeKind.BOOLEAN:
                return Primitive.Boolean;
            case TypeKind.ANY:
                return Primitive.Any;
            case TypeKind.NUMBER:
                return Primitive.Number;
            case TypeKind.STRING:
                return Primitive.String;
            case TypeKind.GENERIC:
                return Primitive.Generic;
            case TypeKind.NULL:
                return Primitive.Null;
            case TypeKind.UNDEFINED:
                return Primitive.Undefined;
            case TypeKind.WASM_I32:
                return WASM.I32;
            case TypeKind.WASM_I64:
                return WASM.I64;
            case TypeKind.WASM_F32:
                return WASM.F32;
            case TypeKind.WASM_F64:
                return WASM.F64;
            case TypeKind.WASM_ANYREF:
                return WASM.ANYREF;
        }

        const valueType = this.types.get(type);
        if (valueType) return valueType;

        switch (type.kind) {
            case TypeKind.ARRAY: {
                const elementType = this.findValueTypeByType(
                    (type as TSArray).elementType,
                );
                Logger.debug(
                    `===== element: ${
                        (type as TSArray).elementType.kind
                    } elementType: ${elementType}`,
                );
                if (!elementType) return undefined;

                switch (elementType.kind) {
                    case ValueTypeKind.ANY:
                        return GetPredefinedType(PredefinedTypeId.ARRAY_ANY)!;
                    case ValueTypeKind.INT:
                        return GetPredefinedType(PredefinedTypeId.ARRAY_INT)!;
                    case ValueTypeKind.NUMBER:
                        return GetPredefinedType(
                            PredefinedTypeId.ARRAY_NUMBER,
                        )!;
                    case ValueTypeKind.STRING:
                        return GetPredefinedType(
                            PredefinedTypeId.ARRAY_STRING,
                        )!;
                }

                for (const t of this.types.values()) {
                    Logger.debug(`==== t: ${t}, elementType: ${elementType}`);
                    if (
                        t.kind == ValueTypeKind.ARRAY &&
                        (t as ArrayType).element.equals(elementType)
                    ) {
                        return t;
                    }
                }
                break;
            }
            //case TypeKind.MAP
            case TypeKind.FUNCTION: {
                const ts_func = type as TSFunction;
                const retType = this.findValueTypeByType(ts_func.returnType);
                if (!retType) return undefined;
                const params: ValueType[] = [];
                for (const p of ts_func.getParamTypes()) {
                    const vt = this.findValueTypeByType(p);
                    if (!vt) return undefined;
                    params.push(vt);
                }

                if (
                    retType.kind == ValueTypeKind.VOID &&
                    (params.length == 0 ||
                        (params.length == 1 &&
                            params[0].kind == ValueTypeKind.VOID))
                ) {
                    return GetPredefinedType(
                        PredefinedTypeId.FUNC_VOID_VOID_METHOD,
                    );
                }

                for (const t of this.types.values()) {
                    if (t.kind == ValueTypeKind.FUNCTION) {
                        const f = t as FunctionType;
                        if (!f.returnType.equals(retType)) continue;
                        if (params.length != f.argumentsType.length) continue;
                        if (f.restParamIdx != ts_func.restParamIdx) continue;
                        let i = 0;
                        for (i = 0; i < params.length; i++) {
                            if (!params[i].equals(f.argumentsType[i])) break;
                        }
                        if (i == params.length) {
                            return t; // found
                        }
                    }
                }
            }
        }
        return valueType;
    }

    findArrayValueType(elementType: ValueType): ValueType | undefined {
        switch (elementType.kind) {
            case ValueTypeKind.NUMBER:
                return GetPredefinedType(PredefinedTypeId.ARRAY_NUMBER);
            case ValueTypeKind.STRING:
                return GetPredefinedType(PredefinedTypeId.ARRAY_STRING);
            case ValueTypeKind.ANY:
                return GetPredefinedType(PredefinedTypeId.ARRAY_ANY);
        }

        if (!elementType) return undefined;
        for (const t of this.types.values()) {
            Logger.debug(`==== t: ${t}, elementType: ${elementType}`);
            if (
                t.kind == ValueTypeKind.ARRAY &&
                (t as ArrayType).element.equals(elementType)
            ) {
                return t;
            }
        }
        return undefined;
    }

    findObjectValueType(tsclass: TSClass): ValueType | undefined {
        for (const t of this.types.keys()) {
            if (!(t instanceof TSClass)) {
                continue;
            }
            if (t === tsclass) {
                return this.types.get(t);
            }
        }
        return undefined;
    }
}
