/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

import {
    SemanticsValue,
    SemanticsValueKind,
    VarValue,
    LiteralValue,
    BinaryExprValue,
    ElementGetValue,
    ElementSetValue,
    CastValue,
    BlockValue,
    ValueBinaryOperator,
} from '../value.js';

import {
    ValueType,
    ValueTypeKind,
    ObjectType,
    Primitive,
    UnionType,
    TypeParameterType,
} from '../value_types.js';

export enum IRCodeKind {
    UNKNOWN,
    /* opcode */
    LOAD_CONST,
    LOAD_STRING,
    LOAD_PARAM,
    LOAD_LOCAL,
    LOAD_GLOBAL,
    LOAD_CLOSURE,
    LOAD_FUNCTION,
    LOAD_CLASS,

    LOAD_UNDEFINED,
    LOAD_NULL,

    SAVE_PARAM,
    SAVE_LOCAL,
    SAVE_GLOBAL,
    SAVE_CLOSURE,

    DROP,
    DUP,
    SWAP, // swap the two value

    NEW_REF,
    READ_REF,
    WRITE_REF,

    ADD,
    SUB,
    MULT,
    DIV,
    MOD,
    // ....

    ASSIGN,
    ASSIGN_ADD,
    ASSIGN_SUB,
    ASSIGN_MULT,
    ASSIGN_DIV,
    ASSIGN_MOD,
    // ....

    LT,
    LTE,
    GT,
    GTE,
    EQ,
    EQ2, // ===
    NEQ,
    NEQ2, // !==

    AND,
    OR,

    NOT,
    INC,
    DEC,
    IS_NULL,

    CALL,
    METHOD_CALL,
    CONSTRUCTOR_CALL,

    GET_OFFSET,
    SET_OFFSET,
    GET_VTABLE,
    SET_VTABLE,
    VTABLE_CALL,
    GET_SHAPE,
    SET_SHAPE,
    SHAPE_CALL,
    GET_DYNAMIC,
    SET_DYNAMIC,
    DYNAMIC_CALL,

    STRING_INDEX_GET,
    STRING_INDEX_SET,
    ARRAY_INDEX_GET,
    ARRAY_INDEX_SET,
    OBJECT_INDEX_GET,
    OBJECT_INDEX_SET,
    OBJECT_KEY_GET,
    OBJECT_KEY_SET,

    NEW_OBJECT,
    NEW_DYNAMIC,
    NEW_CLOSURE,
    NEW_ARRAY_PARAMS,
    NEW_ARRAY_LENGTH,
    INIT_CLOSURE_VALUE,

    INSTANCE_OF,
    INSTANCE_OF_DYNAMIC,

    BUILD_SHAPE,
    BIND_SHAPE,
    UNBOUND_SHAPE,

    GET_KEY_ITER,
    GET_VALUE_ITER,
    NEXT_ITER,

    RETURN,

    VALUE_CAST,

    STATIC_CAST,
    DYN_CAST,

    PUSH_TRY,
    POP_TRY,
    THROW,
    FINALLY_END,

    AWAIT,
    YIELD,

    BLOCK,
    BRANCH,
    BRANCH_TRUE,
    BRANCH_FALSE,

    // for import function
    IMPORT_FUNCTION,
}

export enum IRCodeValueType {
    VOID,
    NATIVE,
    NULL,
    UNDEFINED,
    INT,
    INT8,
    UINT8,
    INT16,
    UINT16,
    INT32,
    UINT32,
    INT64,
    UINT64,
    F32,
    F64,
    BOOLEAN,
    RAW_STRING,
    STRING,
    ANY,
    REFERENCE,
    OBJECT,
    INTERFACE,
    ENUM,
    GENERIC,
}

export function isObjectIRValue(type: IRCodeValueType): boolean {
    return (
        type == IRCodeValueType.STRING ||
        type == IRCodeValueType.OBJECT ||
        type == IRCodeValueType.INTERFACE
    );
}

export function isIntIRValue(type: IRCodeValueType): boolean {
    return type >= IRCodeValueType.INT && type <= IRCodeValueType.UINT64;
}

export function isStringIRValue(type: IRCodeValueType): boolean {
    return type == IRCodeValueType.RAW_STRING || type == IRCodeValueType.STRING;
}

export function isNumberIRValue(type: IRCodeValueType): boolean {
    return type == IRCodeValueType.F32 || type == IRCodeValueType.F64;
}

function GetIRCodeValueType(value: SemanticsValue): IRCodeValueType {
    return GetIRCodeValueTypeFromType(value.type);
}

function GetElementKind(start: IRCodeKind, type: ValueTypeKind): IRCodeKind {
    if (type == ValueTypeKind.INT || type == ValueTypeKind.NUMBER) return start;
    if (type == ValueTypeKind.RAW_STRING || type == ValueTypeKind.STRING)
        return start + 1;
    return start + 2;
}

function GetIRCodeValueTypeFromType(type: ValueType): IRCodeValueType {
    switch (type.kind) {
        case ValueTypeKind.VOID:
        case ValueTypeKind.UNDEFINED:
            return IRCodeValueType.UNDEFINED;
        case ValueTypeKind.NEVER:
        case ValueTypeKind.NULL:
            return IRCodeValueType.NULL;
        case ValueTypeKind.INT:
            return IRCodeValueType.INT;
        case ValueTypeKind.NUMBER:
            return IRCodeValueType.F64;
        case ValueTypeKind.BOOLEAN:
            return IRCodeValueType.BOOLEAN;
        case ValueTypeKind.RAW_STRING:
            return IRCodeValueType.RAW_STRING;
        case ValueTypeKind.STRING:
            return IRCodeValueType.STRING;
        case ValueTypeKind.ANY:
            return IRCodeValueType.ANY;
        case ValueTypeKind.ENUM:
            return IRCodeValueType.ENUM;
        case ValueTypeKind.INTERFACE:
            return IRCodeValueType.INTERFACE;
        case ValueTypeKind.TYPE_PARAMETER:
            return GetIRCodeValueTypeFromType(
                (type as TypeParameterType).wideType,
            );
        case ValueTypeKind.UNION:
            return GetIRCodeValueTypeFromType((type as UnionType).wideType);
        case ValueTypeKind.GENERIC:
            return IRCodeValueType.GENERIC;
        default:
            return IRCodeValueType.OBJECT;
    }
}

const labelId = 1;

export class IRCode {
    constructor(
        public readonly kind: IRCodeKind,
        public readonly type: IRCodeValueType,
        public readonly valueType: ValueType,
        private oph: any = undefined,
    ) {}

    private _typeArguments?: ValueType[];

    get index(): number {
        return this.oph as number;
    }

    get offset(): number {
        return this.oph as number;
    }

    get vtableIndex(): number {
        return (this.oph as number) >> 8;
    }

    get shapeIndex(): number {
        return (this.oph as number) >> 8;
    }

    get dynamicIndex(): number {
        return (this.oph as number) >> 8;
    }

    get paramCount(): number {
        return (this.oph as number) & 0xff;
    }

    get member(): string {
        return this.oph as string;
    }
    get value(): any {
        return this.oph;
    }
    get labelId(): number {
        return this.oph as number;
    }

    get fromType(): IRCodeValueType {
        return this.oph as IRCodeValueType;
    }

    get block(): IRBlock {
        return this.oph as IRBlock;
    }

    setTypeArguments(typeArgs: ValueType[]) {
        this._typeArguments = typeArgs;
    }

    get typeArguments(): ValueType[] | undefined {
        return this._typeArguments;
    }

    toString(): string {
        const op = this.oph ? `${this.oph}` : '';
        return `[${IRCodeKind[this.kind]} ${IRCodeValueType[this.type]} ${op}]`;
    }

    static LoadConst(value: LiteralValue): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_CONST,
            GetIRCodeValueType(value),
            value.type,
            value.value,
        );
    }

    static LoadString(offset: number): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_STRING,
            IRCodeValueType.INT32,
            Primitive.RawString,
            offset,
        );
    }

    static NewUndefined(): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_UNDEFINED,
            IRCodeValueType.UNDEFINED,
            Primitive.Undefined,
        );
    }

    static NewReturn(vt?: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.RETURN,
            vt ? GetIRCodeValueTypeFromType(vt!) : IRCodeValueType.UNDEFINED,
            vt ? vt : Primitive.Undefined,
        );
    }

    static LoadThis(clazz_type: ObjectType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_PARAM,
            IRCodeValueType.OBJECT,
            clazz_type,
            0,
        );
    }

    static LoadLocal(index: number, v: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_LOCAL,
            GetIRCodeValueTypeFromType(v),
            v,
            index,
        );
    }

    static LoadGlobal(index: number, v: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_GLOBAL,
            GetIRCodeValueTypeFromType(v),
            v,
            index,
        );
    }

    static LoadFunction(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_FUNCTION,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }

    static LoadClass(index: number, obj_type: ObjectType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_CLASS,
            IRCodeValueType.OBJECT,
            obj_type,
            index,
        );
    }

    static LoadParam(idx: number, v: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_PARAM,
            GetIRCodeValueTypeFromType(v),
            v,
            idx,
        );
    }

    static LoadClosure(index: number, v: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.LOAD_CLOSURE,
            GetIRCodeValueTypeFromType(v),
            v,
            index,
        );
    }

    static NewRef(vt?: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.NEW_REF,
            IRCodeValueType.REFERENCE,
            vt ? vt : Primitive.Any,
        );
    }
    static ReadRef(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.READ_REF,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }
    static WriteRef(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.WRITE_REF,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewSave(v: VarValue): IRCode {
        let kind = IRCodeKind.SAVE_PARAM;
        switch (v.kind) {
            case SemanticsValueKind.LOCAL_VAR:
            case SemanticsValueKind.LOCAL_CONST:
                kind = IRCodeKind.SAVE_LOCAL;
                break;
            case SemanticsValueKind.GLOBAL_VAR:
            case SemanticsValueKind.GLOBAL_CONST:
                kind = IRCodeKind.SAVE_GLOBAL;
                break;
            case SemanticsValueKind.PARAM_VAR:
                kind = IRCodeKind.SAVE_PARAM;
                break;
            case SemanticsValueKind.CLOSURE_VAR:
                //kind = IRCodeKind.SAVE_CLOSURE_REF;
                break;
            default:
                throw Error(
                    `unknown the opcode: ${SemanticsValueKind[v.kind]}`,
                );
                break;
        }
        return new IRCode(kind, GetIRCodeValueType(v), v.type, v.index);
    }

    static SaveParam(index: number, type: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SAVE_PARAM,
            GetIRCodeValueTypeFromType(type),
            type,
            index,
        );
    }

    static SaveLocal(index: number, type: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SAVE_LOCAL,
            GetIRCodeValueTypeFromType(type),
            type,
            index,
        );
    }

    static SaveGlobal(index: number, type: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SAVE_GLOBAL,
            GetIRCodeValueTypeFromType(type),
            type,
            index,
        );
    }

    static SaveClosure(index: number, type: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SAVE_CLOSURE,
            GetIRCodeValueTypeFromType(type),
            type,
            index,
        );
    }

    static NewBinaryOp(opKind: ValueBinaryOperator, type: ValueType): IRCode {
        let kind = IRCodeKind.ADD;
        switch (opKind) {
            case ts.SyntaxKind.PlusEqualsToken:
            case ts.SyntaxKind.PlusToken:
                kind = IRCodeKind.ADD;
                break;
            case ts.SyntaxKind.MinusEqualsToken:
            case ts.SyntaxKind.MinusToken:
                kind = IRCodeKind.SUB;
                break;
            case ts.SyntaxKind.AsteriskEqualsToken:
            case ts.SyntaxKind.AsteriskToken:
                kind = IRCodeKind.MULT;
                break;
            case ts.SyntaxKind.SlashEqualsToken:
            case ts.SyntaxKind.SlashToken:
                kind = IRCodeKind.DIV;
                break;
            case ts.SyntaxKind.PercentEqualsToken:
            case ts.SyntaxKind.PercentToken:
                kind = IRCodeKind.MOD;
                break;
            case ts.SyntaxKind.LessThanToken:
                kind = IRCodeKind.LT;
                break;
            case ts.SyntaxKind.LessThanEqualsToken:
                kind = IRCodeKind.LTE;
                break;
            case ts.SyntaxKind.GreaterThanToken:
                kind = IRCodeKind.GT;
                break;
            case ts.SyntaxKind.GreaterThanEqualsToken:
                kind = IRCodeKind.GTE;
                break;
            case ts.SyntaxKind.EqualsEqualsToken:
                kind = IRCodeKind.EQ;
                break;
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
                kind = IRCodeKind.EQ2;
                break;
            case ts.SyntaxKind.ExclamationEqualsToken:
                kind = IRCodeKind.NEQ;
                break;
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                kind = IRCodeKind.NEQ2;
                break;
            case ts.SyntaxKind.AmpersandAmpersandToken:
                kind = IRCodeKind.AND;
                break;
            case ts.SyntaxKind.BarBarToken:
                kind = IRCodeKind.OR;
                break;
            default:
                throw Error(`unknown binary operator ${ts.SyntaxKind[opKind]}`);
        }
        return new IRCode(kind, GetIRCodeValueTypeFromType(type), type);
    }

    static NewCall(
        type: ValueType,
        param_count: number,
        typeArgs?: ValueType[],
    ): IRCode {
        const code = new IRCode(
            IRCodeKind.CALL,
            GetIRCodeValueTypeFromType(type),
            type,
            param_count,
        );
        if (typeArgs) code.setTypeArguments(typeArgs);
        return code;
    }

    static NewMethodCall(
        type: ValueType,
        param_count: number,
        typeArgs?: ValueType[],
    ): IRCode {
        const code = new IRCode(
            IRCodeKind.METHOD_CALL,
            GetIRCodeValueTypeFromType(type),
            type,
            param_count,
        );

        if (typeArgs) code.setTypeArguments(typeArgs);
        return code;
    }

    static NewConstructorCall(
        type: ValueType,
        param_count: number,
        typeArgs?: ValueType[],
    ): IRCode {
        const code = new IRCode(
            IRCodeKind.CONSTRUCTOR_CALL,
            IRCodeValueType.UNDEFINED,
            type,
            param_count,
        );

        if (typeArgs) code.setTypeArguments(typeArgs);
        return code;
    }

    static NewDupStackValue(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.DUP,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }
    static NewSwap(): IRCode {
        return new IRCode(IRCodeKind.SWAP, IRCodeValueType.ANY, Primitive.Void);
    }

    static NewObject(idx: number, t: ObjectType): IRCode {
        return new IRCode(
            IRCodeKind.NEW_OBJECT,
            IRCodeValueType.OBJECT,
            t,
            idx,
        );
    }
    static NewDynamic(vt: ValueType): IRCode {
        return new IRCode(IRCodeKind.NEW_DYNAMIC, IRCodeValueType.OBJECT, vt);
    }

    static NewArrayLength(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.NEW_ARRAY_LENGTH,
            IRCodeValueType.OBJECT,
            vt,
        );
    }

    static NewArrayParameters(argc: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.NEW_ARRAY_PARAMS,
            IRCodeValueType.OBJECT,
            vt,
            argc,
        );
    }

    static NewClosure(func_idx: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.NEW_CLOSURE,
            IRCodeValueType.OBJECT,
            vt,
            func_idx,
        );
    }

    static InitClosureValue(idx: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.INIT_CLOSURE_VALUE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            idx,
        );
    }

    static NewStringIndexGet(): IRCode {
        return new IRCode(
            IRCodeKind.STRING_INDEX_GET,
            IRCodeValueType.STRING,
            Primitive.String,
        );
    }

    static NewStringIndexSet(): IRCode {
        return new IRCode(
            IRCodeKind.STRING_INDEX_SET,
            IRCodeValueType.STRING,
            Primitive.String,
        );
    }

    static NewArrayIndexGet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.ARRAY_INDEX_GET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewArrayIndexSet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.ARRAY_INDEX_SET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewObjectIndexGet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.OBJECT_INDEX_GET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewObjectIndexSet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.OBJECT_INDEX_SET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewObjectKeyGet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.OBJECT_KEY_GET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewObjectKeySet(vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.OBJECT_KEY_SET,
            GetIRCodeValueTypeFromType(vt),
            vt,
        );
    }

    static NewGetOffset(offset: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.GET_OFFSET,
            GetIRCodeValueTypeFromType(vt),
            vt,
            offset,
        );
    }

    static NewSetOffset(offset: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SET_OFFSET,
            GetIRCodeValueTypeFromType(vt),
            vt,
            offset,
        );
    }

    static NewGetVTable(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.GET_VTABLE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }

    static NewSetVTable(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SET_VTABLE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }

    static NewVTableCall(
        index: number,
        param_count: number,
        vt: ValueType,
    ): IRCode {
        return new IRCode(
            IRCodeKind.VTABLE_CALL,
            GetIRCodeValueTypeFromType(vt),
            vt,
            ((index & 0xffffff) << 8) | (param_count & 0xff),
        );
    }

    static NewGetShape(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.GET_SHAPE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }

    static NewSetShape(index: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.SET_SHAPE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            index,
        );
    }

    static NewShapeCall(
        index: number,
        param_count: number,
        vt: ValueType,
    ): IRCode {
        return new IRCode(
            IRCodeKind.SHAPE_CALL,
            GetIRCodeValueTypeFromType(vt),
            vt,
            ((index & 0xffffff) << 8) | (param_count & 0xff),
        );
    }

    static NewGetDynamic(index: number): IRCode {
        return new IRCode(
            IRCodeKind.GET_DYNAMIC,
            IRCodeValueType.ANY,
            Primitive.Any,
            index,
        );
    }

    static NewSetDynamic(index: number): IRCode {
        return new IRCode(
            IRCodeKind.SET_DYNAMIC,
            IRCodeValueType.ANY,
            Primitive.Any,
            index,
        );
    }

    static NewDynamicCall(index: number, param_count: number): IRCode {
        return new IRCode(
            IRCodeKind.DYNAMIC_CALL,
            IRCodeValueType.ANY,
            Primitive.Any,
            ((index & 0xffffff) << 8) | (param_count & 0xff),
        );
    }

    static NewBlock(block: BlockValue): IRCode {
        const ir_block = new IRBlock(block.label, block.isLoop);
        return new IRCode(
            IRCodeKind.BLOCK,
            GetIRCodeValueTypeFromType(block.type),
            block.type,
            ir_block,
        );
    }

    static NewBindShape(shape_idx: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.BIND_SHAPE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            shape_idx,
        );
    }

    static NewBuildShape(meta_idx: number, vt: ValueType): IRCode {
        return new IRCode(
            IRCodeKind.BUILD_SHAPE,
            GetIRCodeValueTypeFromType(vt),
            vt,
            meta_idx,
        );
    }

    static NewBranch(target: IRBlock): IRCode {
        return new IRCode(
            IRCodeKind.BRANCH,
            IRCodeValueType.UNDEFINED,
            Primitive.Undefined,
            target,
        );
    }

    static NewBranchIf(target: IRBlock, isTrue: boolean): IRCode {
        return new IRCode(
            isTrue ? IRCodeKind.BRANCH_TRUE : IRCodeKind.BRANCH_FALSE,
            IRCodeValueType.UNDEFINED,
            Primitive.Undefined,
            target,
        );
    }

    static NewImportFunction(moduleIndex: number, funcIndex: number): IRCode {
        return new IRCode(
            IRCodeKind.IMPORT_FUNCTION,
            IRCodeValueType.UNDEFINED,
            Primitive.Undefined,
            ((moduleIndex & 0xffff) << 16) | (funcIndex & 0xffff),
        );
    }
}

export class IRBlock {
    public codes: IRCode[] = [];
    public parent?: IRBlock;
    constructor(
        public readonly label: string,
        public readonly isLoop: boolean,
    ) {}

    add(code: IRCode) {
        this.codes.push(code);
    }
}
