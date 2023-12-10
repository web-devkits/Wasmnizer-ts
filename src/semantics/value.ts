/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

import { DumpWriter } from './dump.js';
import {
    ValueTypeKind,
    ValueType,
    PrimitiveType,
    Primitive,
    PrimitiveValueType,
    FunctionType,
    UnionType,
    ArrayType,
    TypeParameterType,
    ObjectType,
    WASMType,
} from './value_types.js';
import { PredefinedTypeId, SourceLocation } from '../utils.js';
import { SymbolKeyToString } from './builder_context.js';
import { FunctionDeclareNode, VarDeclareNode } from './semantics_nodes.js';
import { Shape, ShapeMember, Value } from './runtime.js';
import { GetPredefinedType } from './predefined_types.js';
import { GetShapeFromType } from './builtin.js';

export enum SemanticsValueKind {
    NOP,
    UNIMPLEMENT,
    // terminal symbol
    THIS,
    SUPER,
    LITERAL,
    LOCAL_VAR,
    LOCAL_CONST,
    PARAM_VAR,
    GLOBAL_VAR,
    GLOBAL_CONST,
    CLOSURE_VAR,
    CLOSURE_CONST,
    TEMPL_VAR,

    // expression
    BINARY_EXPR,
    POST_UNARY_EXPR,
    PRE_UNARY_EXPR,
    CONDITION_EXPR,
    COMMA_EXPR,

    FUNCTION_CALL,
    CLOSURE_CALL,
    CONSTRUCTOR_CALL,
    ANY_CALL,

    NEW_CLASS,
    NEW_CLOSURE_FUNCTION,

    OBJECT_CAST_OBJECT,
    OBJECT_CAST_VALUE, // cast to boolean
    OBJECT_CAST_UNION,
    VALUE_CAST_ANY,
    VALUE_CAST_UNION,
    OBJECT_CAST_ANY,
    VALUE_CAST_VALUE,
    VALUE_CAST_OBJECT, // null/undefined to object
    ANY_CAST_VALUE,
    ANY_CAST_OBJECT,
    ANY_CAST_INTERFACE,
    UNION_CAST_VALUE,
    UNION_CAST_OBJECT,
    UNION_CAST_ANY,

    VALUE_TO_STRING,
    OBJECT_TO_STRING,

    INSTANCE_OF,

    ENUM_KEY_GET,

    DYNAMIC_GET,
    DYNAMIC_SET,
    DYNAMIC_CALL,
    SHAPE_GET,
    SHAPE_SET,
    SHAPE_CALL,
    OFFSET_GET,
    OFFSET_SET,
    OFFSET_GETTER,
    OFFSET_SETTER,
    OFFSET_CALL,
    VTABLE_GET,
    VTABLE_SET,
    VTABLE_CALL,
    DIRECT_GETTER,
    DIRECT_SETTER,
    DIRECT_CALL,
    DIRECT_GET,
    ENUMERATE_KEY_GET,

    STRING_INDEX_GET,
    STRING_INDEX_SET,
    ARRAY_INDEX_GET,
    ARRAY_INDEX_SET,
    OBJECT_INDEX_GET,
    OBJECT_INDEX_SET,
    OBJECT_KEY_GET,
    OBJECT_KEY_SET,

    NEW_CONSTRCTOR_OBJECT,
    NEW_LITERAL_OBJECT,
    NEW_LITERAL_ARRAY,
    NEW_ARRAY,
    NEW_ARRAY_LEN,
    NEW_FROM_CLASS_OBJECT,

    // FOR flatten
    BLOCK,
    BLOCK_BRANCH,
    BLOCK_BRANCH_IF,

    RET,

    TYPEOF,
    TEMPLATE_EXPRESSION,
    REBINDING,
    SPREAD,
}

export type ValueBinaryOperator = ts.BinaryOperator;

export interface SemanticsValueVisitor {
    (value: SemanticsValue): void;
}

export class SemanticsValue implements Value {
    constructor(public kind: SemanticsValueKind, public type: ValueType) {}

    toString(): string {
        return `[${SemanticsValueKind[this.kind]} ${this.type}]`;
    }
    location: SourceLocation | null = null;
    dump(writer: DumpWriter) {
        writer.write(this.toString());
        writer.shift();
        this.forEachChild((v) => v.dump(writer));
        writer.unshift();
    }

    get effectType(): ValueType {
        if (this.type.kind == ValueTypeKind.TYPE_PARAMETER)
            return (this.type as TypeParameterType).wideType;
        return this.type;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        return;
    }

    private _shape?: Shape;
    get shape(): Shape | undefined {
        // TODO get the basic shape
        return this._shape ? this._shape : GetShapeFromType(this.effectType);
    }

    set shape(s: Shape | undefined) {
        this._shape = s;
    }

    get valueAccessCount(): number {
        return 0;
    }

    incAccessCount() {
        return;
    }
}

export class ThisValue2 extends SemanticsValue {
    constructor(type: ObjectType) {
        super(SemanticsValueKind.THIS, type);
        this.shape = type.instanceType!.meta.thisShape;
    }
}

/* When we use the ”super" keyword, there are two situations:
    1. super(...), this means that the constructor of the base class needs to be called;
        e.g.
            class B extends A {
                constructor(x: number, y: string) {
                    super(x);
                }
            }
    2. super.xxx, at this time, "super" represents the base class.
        e.g.
            class B extends A {
                log() {
                    super.log();
                }
            }

   So, we use "SuperUsageFlag" to distinguish between these two situations.
*/
export enum SuperUsageFlag {
    SUPER_CALL,
    SUPER_LITERAL,
}

export class SuperValue extends SemanticsValue {
    private _parameters: SemanticsValue[] | undefined;
    private _usageFlag = SuperUsageFlag.SUPER_CALL;

    constructor(
        type: ObjectType,
        usageFlag: SuperUsageFlag,
        parameters?: SemanticsValue[],
    ) {
        super(SemanticsValueKind.SUPER, type);
        this.shape = type.instanceType!.meta.originShape;
        this._parameters = parameters;
        this._usageFlag = usageFlag;
    }

    get parameters(): SemanticsValue[] | undefined {
        return this._parameters;
    }

    get usageFlag(): SuperUsageFlag {
        return this._usageFlag;
    }
}

export class NopValue extends SemanticsValue {
    constructor() {
        super(SemanticsValueKind.NOP, Primitive.Void);
    }
}

export class LiteralValue extends SemanticsValue {
    constructor(
        type: PrimitiveType | WASMType,
        public value: PrimitiveValueType,
    ) {
        super(SemanticsValueKind.LITERAL, type);
    }

    toString(): string {
        return `[Literal ${this.type}  ${this.value}]`;
    }
}

export type LocalVarValueKind =
    | SemanticsValueKind.LOCAL_VAR
    | SemanticsValueKind.LOCAL_CONST;
export type GlobalVarValueKind =
    | SemanticsValueKind.GLOBAL_VAR
    | SemanticsValueKind.GLOBAL_CONST;
export type ClosureVarValueKind =
    | SemanticsValueKind.CLOSURE_VAR
    | SemanticsValueKind.CLOSURE_CONST;
export type VarValueKind =
    | LocalVarValueKind
    | GlobalVarValueKind
    | ClosureVarValueKind
    | SemanticsValueKind.PARAM_VAR;

function VarRefToString(ref: any): string {
    if (ref instanceof ValueType) {
        return (ref as ValueType).toString();
    } else if (ref instanceof FunctionDeclareNode) {
        return (ref as FunctionDeclareNode).toString();
    } else if (ref instanceof VarDeclareNode) {
        return (ref as VarDeclareNode).toString();
    }
    return `${ref}`;
}

export class VarValue extends SemanticsValue {
    constructor(
        kind: VarValueKind,
        type: ValueType,
        public ref: any,
        public index: number | string,
    ) {
        super(kind, type);
        if (type instanceof ObjectType) {
            this.shape = (type as ObjectType).meta.thisShape;
        }
    }

    copy() {
        const newVarValue = new VarValue(
            this.kind as VarValueKind,
            this.type,
            this.ref,
            this.index,
        );
        newVarValue.shape = this.shape;
        return newVarValue;
    }

    get isConst(): boolean {
        return (
            this.kind == SemanticsValueKind.LOCAL_CONST ||
            this.kind == SemanticsValueKind.GLOBAL_CONST ||
            this.kind == SemanticsValueKind.CLOSURE_CONST
        );
    }

    toString(): string {
        return `[VarValue(${SemanticsValueKind[this.kind]}): ${this.type} ${
            this.index
        }  "${VarRefToString(this.ref)}"]`;
    }

    private _valueAccessCount = 0;
    get valueAccessCount(): number {
        return this._valueAccessCount;
    }
    incAccessCount() {
        this._valueAccessCount++;
    }
}

export class BinaryExprValue extends SemanticsValue {
    constructor(
        type: ValueType,
        public opKind: ValueBinaryOperator,
        public left: SemanticsValue,
        public right: SemanticsValue,
    ) {
        super(SemanticsValueKind.BINARY_EXPR, type);
    }

    toString(): string {
        return `[BinaryExpr "${operatorString(this.opKind)}" ${this.type}]`;
    }

    dump(writer: DumpWriter) {
        writer.write(`[BinaryExpr "${operatorString(this.opKind)}"]`);
        writer.shift();
        this.left.dump(writer);
        this.right.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.left);
        visitor(this.right);
    }
}

export class PrefixUnaryExprValue extends SemanticsValue {
    constructor(
        type: PrimitiveType,
        public opKind: ts.PrefixUnaryOperator,
        public target: SemanticsValue,
        flattenExprValue?: SemanticsValue,
    ) {
        super(SemanticsValueKind.PRE_UNARY_EXPR, type);
        if (flattenExprValue) {
            this._flattenExprValue = flattenExprValue;
        }
    }

    private _flattenExprValue?: SemanticsValue;

    setFlattenExprValue(flattenExprValue: SemanticsValue) {
        this._flattenExprValue = flattenExprValue;
    }

    get flattenExprValue(): SemanticsValue | undefined {
        return this._flattenExprValue;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.target);
    }
}

export class PostUnaryExprValue extends SemanticsValue {
    constructor(
        type: PrimitiveType,
        public opKind: ts.PostfixUnaryOperator,
        public target: SemanticsValue,
        flattenExprValue?: SemanticsValue,
    ) {
        super(SemanticsValueKind.POST_UNARY_EXPR, type);
        if (flattenExprValue) {
            this._flattenExprValue = flattenExprValue;
        }
    }

    private _flattenExprValue?: SemanticsValue;

    setFlattenExprValue(flattenExprValue: SemanticsValue) {
        this._flattenExprValue = flattenExprValue;
    }

    get flattenExprValue(): SemanticsValue | undefined {
        return this._flattenExprValue;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.target);
    }
}

export class ConditionExprValue extends SemanticsValue {
    constructor(
        type: ValueType,
        public condition: SemanticsValue,
        public trueExpr: SemanticsValue,
        public falseExpr: SemanticsValue,
    ) {
        super(SemanticsValueKind.CONDITION_EXPR, type);
    }

    dump(writer: DumpWriter) {
        writer.write(`[Condition]`);
        writer.shift();
        this.condition.dump(writer);
        this.trueExpr.dump(writer);
        this.falseExpr.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.condition);
        visitor(this.trueExpr);
        visitor(this.falseExpr);
    }
}

export class CommaExprValue extends SemanticsValue {
    constructor(type: ValueType, public exprs: SemanticsValue[]) {
        super(SemanticsValueKind.COMMA_EXPR, type);
    }
    dump(writer: DumpWriter) {
        writer.write(`[CommaExpr]`);
        writer.shift();
        for (const expr of this.exprs) {
            expr.dump(writer);
            writer.write(', ');
        }
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        this.exprs.forEach((expr) => visitor(expr));
    }
}

export class FunctionCallBaseValue extends SemanticsValue {
    constructor(
        kind: SemanticsValueKind,
        type: ValueType,
        public funcType: FunctionType,
        public parameters?: SemanticsValue[],
    ) {
        super(kind, type);
    }

    private _typeArguments?: ValueType[];

    setTypeArguments(typeArgs: ValueType[]) {
        this._typeArguments = typeArgs;
    }

    get typeArguments(): ValueType[] | undefined {
        return this._typeArguments;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        if (this.parameters) {
            for (const p of this.parameters) visitor(p);
        }
    }
}

export class FunctionCallValue extends FunctionCallBaseValue {
    constructor(
        type: ValueType,
        public func: SemanticsValue,
        funcType?: FunctionType,
        parameters?: SemanticsValue[],
    ) {
        super(
            SemanticsValueKind.FUNCTION_CALL,
            type,
            funcType ? funcType : (func.type as FunctionType),
            parameters,
        );
    }

    dump(writer: DumpWriter) {
        writer.write(`[FunctionCall return ${this.type}]`);
        writer.shift();
        this.func.dump(writer);
        if (this.parameters) {
            for (const p of this.parameters) p.dump(writer);
        }
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.func);
        if (this.parameters) this.parameters.forEach((p) => visitor(p));
    }
}

export class EnumerateKeysGetValue extends SemanticsValue {
    constructor(public type: ValueType, public obj: SemanticsValue) {
        super(SemanticsValueKind.ENUMERATE_KEY_GET, type);
    }

    dump(writer: DumpWriter) {
        writer.write(`[EnumerateKeysGetValue]`);
        writer.shift();
        this.obj.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.obj);
    }
}

export class NewClosureFunction extends SemanticsValue {
    constructor(
        public readonly funcNode: FunctionDeclareNode,
        public readonly closureInitList?: VarValue[],
    ) {
        super(SemanticsValueKind.NEW_CLOSURE_FUNCTION, funcNode.funcType);
    }

    toString(): string {
        return `[NewClosureFunction ${this.funcNode}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        if (this.closureInitList) {
            for (const p of this.closureInitList) {
                if (p) visitor(p);
            }
        }
    }
}

export class ClosureCallValue extends FunctionCallBaseValue {
    constructor(
        type: ValueType,
        public func: SemanticsValue,
        funcType?: FunctionType,
        parameters?: SemanticsValue[],
    ) {
        super(
            SemanticsValueKind.CLOSURE_CALL,
            type,
            funcType ? funcType : (func.type as FunctionType),
            parameters,
        );
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.func);
        if (this.parameters) this.parameters.forEach((p) => visitor(p));
    }
}

export class ConstructorCallValue extends FunctionCallBaseValue {
    constructor(
        public self: SemanticsValue,
        public ctr: SemanticsValue,
        funcType: FunctionType,
        parameters?: SemanticsValue[],
    ) {
        super(
            SemanticsValueKind.CONSTRUCTOR_CALL,
            Primitive.Void,
            funcType,
            parameters,
        );
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.self);
        if (this.parameters) this.parameters.forEach((p) => visitor(p));
    }
}

export class AnyCallValue extends SemanticsValue {
    constructor(
        type: ValueType,
        public anyFunc: SemanticsValue,
        public parameters?: SemanticsValue[],
    ) {
        super(SemanticsValueKind.ANY_CALL, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.anyFunc);
        if (this.parameters) this.parameters.forEach((p) => visitor(p));
    }
}

export type ElementGetValueKind =
    | SemanticsValueKind.STRING_INDEX_GET
    | SemanticsValueKind.ARRAY_INDEX_GET
    | SemanticsValueKind.OBJECT_KEY_GET
    | SemanticsValueKind.ENUM_KEY_GET;

export class ElementGetValue extends SemanticsValue {
    constructor(
        kind: ElementGetValueKind,
        type: ValueType,
        public owner: SemanticsValue,
        public index: SemanticsValue,
    ) {
        super(kind, type);
    }

    dump(writer: DumpWriter) {
        writer.write(
            `[ElementGet(${SemanticsValueKind[this.kind]}) ${this.type}]`,
        );
        writer.shift();
        this.owner.dump(writer);
        this.index.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        visitor(this.index);
    }
}

export type ElementSetValueKind =
    | SemanticsValueKind.STRING_INDEX_SET
    | SemanticsValueKind.ARRAY_INDEX_SET
    | SemanticsValueKind.OBJECT_KEY_SET;

export class ElementSetValue extends SemanticsValue {
    constructor(
        kind: ElementSetValueKind,
        type: ValueType,
        public owner: SemanticsValue,
        public index: SemanticsValue,
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(kind, type);
    }

    dump(writer: DumpWriter) {
        writer.write(
            `[ElementSet(${SemanticsValueKind[this.kind]}) ${this.type}  ${
                this.opKind ? operatorString(this.opKind) : 'Unkonwn'
            }]`,
        );
        writer.shift();
        this.owner.dump(writer);
        this.index.dump(writer);
        if (this.value) this.value.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        visitor(this.index);
        if (this.value) visitor(this.value);
    }
}

type CastValueKind =
    | SemanticsValueKind.VALUE_CAST_VALUE
    | SemanticsValueKind.VALUE_CAST_OBJECT
    | SemanticsValueKind.VALUE_CAST_ANY
    | SemanticsValueKind.VALUE_CAST_UNION
    | SemanticsValueKind.OBJECT_CAST_OBJECT
    | SemanticsValueKind.OBJECT_CAST_VALUE
    | SemanticsValueKind.OBJECT_CAST_UNION
    | SemanticsValueKind.OBJECT_CAST_ANY
    | SemanticsValueKind.UNION_CAST_VALUE
    | SemanticsValueKind.UNION_CAST_OBJECT
    | SemanticsValueKind.UNION_CAST_ANY
    | SemanticsValueKind.ANY_CAST_INTERFACE
    | SemanticsValueKind.ANY_CAST_OBJECT
    | SemanticsValueKind.ANY_CAST_VALUE;
export class CastValue extends SemanticsValue {
    constructor(
        kind: CastValueKind,
        type: ValueType,
        public value: SemanticsValue,
    ) {
        super(kind, type);
    }

    dump(writer: DumpWriter) {
        const vt_str = 'DYNAMIC_CAST';
        writer.write(
            `[CastValue(${SemanticsValueKind[this.kind]}) From "${
                this.value.type
            }" To "${this.type}"]`,
        );
        writer.shift();
        this.value.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.value);
    }
}

export class InstanceOfValue extends SemanticsValue {
    constructor(
        public value: SemanticsValue,
        public classObject: SemanticsValue,
    ) {
        super(SemanticsValueKind.INSTANCE_OF, Primitive.Boolean);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.value);
    }
}

export class NewClassValue extends SemanticsValue {
    constructor(type: ValueType) {
        super(SemanticsValueKind.NEW_CLASS, type);
    }
}

export type ToStringValueKind =
    | SemanticsValueKind.VALUE_TO_STRING
    | SemanticsValueKind.OBJECT_TO_STRING;

export class ToStringValue extends SemanticsValue {
    constructor(kind: ToStringValueKind, public value: SemanticsValue) {
        super(kind, Primitive.String);
    }

    dump(writer: DumpWriter) {
        writer.write(`[ToString]`);
        writer.shift();
        this.value.dump(writer);
        writer.unshift();
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.value);
    }
}

/** for typeof, iff value is any type, which can't be determined in compile time, so here
 * create TypeofValue to determine the type in runtime
 */
export class TypeofValue extends SemanticsValue {
    constructor(public value: SemanticsValue) {
        super(SemanticsValueKind.TYPEOF, Primitive.String);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.value);
    }
}

export class TemplateExprValue extends SemanticsValue {
    constructor(public head: SemanticsValue, public follows: SemanticsValue[]) {
        super(SemanticsValueKind.TEMPLATE_EXPRESSION, Primitive.String);
    }

    forEachChild(visitor: SemanticsValueVisitor): void {
        visitor(this.head);
        (this.follows || []).forEach((v) => visitor(v));
    }
}

export class UnimplementValue extends SemanticsValue {
    constructor(public tsNode: ts.Node) {
        super(SemanticsValueKind.UNIMPLEMENT, Primitive.Void);
    }

    toString(): string {
        const sourceFile = this.tsNode.getSourceFile();
        const start = this.tsNode.getStart(sourceFile);
        const startLineInfo = sourceFile.getLineAndCharacterOfPosition(start);
        const source_info = `@"${sourceFile.fileName}":${
            startLineInfo.line + 1
        }:${startLineInfo.character}  source: ${this.tsNode.getFullText(
            sourceFile,
        )}`;
        return `[Unimplement ExpressionKind: ${
            ts.SyntaxKind[this.tsNode.kind]
        } ${source_info}]`;
    }
}

export class DynamicGetValue extends SemanticsValue {
    /* 'isMethodCall' determines the specific semantics of member function property access,
        whether it is just to obtain the member function property value,
        or needs to call the member function.
    */
    constructor(
        public owner: SemanticsValue,
        public name: string,
        public isMethodCall: boolean,
    ) {
        super(SemanticsValueKind.DYNAMIC_GET, Primitive.Any);
    }

    toString(): string {
        return `[DynamicGet ${this.name}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DynamicSetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        public name: string,
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.DYNAMIC_SET, Primitive.Any);
    }

    toString(): string {
        return `[DynamicSet ${this.name}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DynamicCallValue extends FunctionCallBaseValue {
    constructor(public owner: SemanticsValue, public name: string) {
        const methodType = GetPredefinedType(
            PredefinedTypeId.FUNC_ANY_ARRAY_ANY_DEFAULT,
        )!;
        super(
            SemanticsValueKind.DYNAMIC_CALL,
            Primitive.Any,
            methodType as FunctionType,
        );
    }

    toString(): string {
        return `[DynamicCall ${this.name}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class ShapeGetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
    ) {
        super(SemanticsValueKind.SHAPE_GET, type);
    }

    toString(): string {
        return `[ShapeGet ${this.index}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class ShapeSetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.SHAPE_SET, type);
    }

    toString(): string {
        return `[ShapeSet ${this.index}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class ShapeCallValue extends FunctionCallBaseValue {
    constructor(
        public owner: SemanticsValue,
        funcType: FunctionType,
        public index: number,
    ) {
        super(SemanticsValueKind.SHAPE_CALL, funcType.returnType, funcType);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }

    toString(): string {
        return `[ShapeCall RET: ${this.type} OF ${this.owner}@${this.index}]`;
    }
}

export class OffsetGetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
    ) {
        super(SemanticsValueKind.OFFSET_GET, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class OffsetSetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.OFFSET_SET, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class OffsetGetterValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
    ) {
        super(SemanticsValueKind.OFFSET_GETTER, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class OffsetSetterValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
        public getterIndex?: number, // for +=, *=, /= ...
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.OFFSET_SETTER, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class OffsetCallValue extends FunctionCallBaseValue {
    constructor(
        public owner: SemanticsValue,
        funcType: FunctionType,
        public index: number,
    ) {
        super(SemanticsValueKind.OFFSET_CALL, funcType.returnType, funcType);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }

    toString(): string {
        return `[OffsetCall ${this.funcType}@${this.index}]`;
    }
}

export class VTableGetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
    ) {
        super(SemanticsValueKind.VTABLE_GET, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class VTableSetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.VTABLE_SET, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class VTableCallValue extends FunctionCallBaseValue {
    constructor(
        public owner: SemanticsValue,
        funcType: FunctionType,
        public index: number,
    ) {
        super(SemanticsValueKind.VTABLE_CALL, funcType.returnType, funcType);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DirectGetterValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public getter: Value,
    ) {
        super(SemanticsValueKind.DIRECT_GETTER, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DirectCallValue extends FunctionCallBaseValue {
    constructor(
        public owner: SemanticsValue,
        methodType: FunctionType,
        public method: Value,
    ) {
        super(
            SemanticsValueKind.DIRECT_CALL,
            methodType.returnType,
            methodType,
        );
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DirectSetterValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public setter: Value,
        public getter?: Value, // for +=, *=, ...
        public value?: SemanticsValue,
        public opKind?: ValueBinaryOperator,
    ) {
        super(SemanticsValueKind.DIRECT_SETTER, type);
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export class DirectGetValue extends SemanticsValue {
    constructor(
        public owner: SemanticsValue,
        type: ValueType,
        public index: number,
    ) {
        super(SemanticsValueKind.DIRECT_GET, type);
    }

    toString(): string {
        return `[DirectGet ${this.index}]`;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        visitor(this.owner);
        super.forEachChild(visitor);
    }
}

export type MemberGetValue =
    | DynamicGetValue
    | ShapeGetValue
    | VTableGetValue
    | OffsetGetValue
    | OffsetGetterValue
    | DirectGetterValue
    | ElementGetValue;
export type MemberSetValue =
    | DynamicSetValue
    | ShapeSetValue
    | VTableSetValue
    | OffsetSetValue
    | OffsetSetterValue
    | DirectSetterValue
    | ElementSetValue;
export type MemberCallValue =
    | DynamicCallValue
    | ShapeCallValue
    | VTableCallValue
    | OffsetCallValue
    | DirectCallValue;

export class NewLiteralObjectValue extends SemanticsValue {
    public initValues: Array<SemanticsValue>;
    constructor(type: ObjectType) {
        super(SemanticsValueKind.NEW_LITERAL_OBJECT, type);
        this.initValues = new Array(type.meta.members.length);
        this.shape = type.meta.originShape;
    }

    get objectType(): ObjectType {
        return this.type as ObjectType;
    }

    setField(index: number, value: SemanticsValue) {
        this.initValues[index] = value;
    }
}

export class NewLiteralArrayValue extends SemanticsValue {
    constructor(type: ValueType, public initValues: SemanticsValue[]) {
        super(SemanticsValueKind.NEW_LITERAL_ARRAY, type);
        // TODO get the shape
        this.shape = (type as ArrayType).instanceType!.meta.originShape;
    }
}

export class NewConstructorObjectValue extends SemanticsValue {
    constructor(
        type: ValueType,
        //public readonly clazz: SemanticsValue,
        public readonly parameters: SemanticsValue[],
        kind: SemanticsValueKind = SemanticsValueKind.NEW_CONSTRCTOR_OBJECT,
    ) {
        super(kind, type);
        if (type.kind == ValueTypeKind.OBJECT)
            this.shape = (type as ObjectType).instanceType!.meta.originShape;
        else if (type.kind == ValueTypeKind.TYPE_PARAMETER) {
            const wide_type = (type as TypeParameterType).wideType;
            if (wide_type.kind == ValueTypeKind.OBJECT)
                this.shape = (
                    wide_type as ObjectType
                ).instanceType!.meta.originShape;
        }
    }

    get objectType(): ObjectType {
        return this.type as ObjectType;
    }

    private _typeArguments?: ValueType[];

    setTypeArguments(typeArgs: ValueType[]) {
        this._typeArguments = typeArgs;
    }

    get typeArguments(): ValueType[] | undefined {
        return this._typeArguments;
    }

    forEachChild(visitor: SemanticsValueVisitor) {
        if (this.parameters) {
            for (const p of this.parameters) visitor(p);
        }
    }
}

export class NewArrayValue extends NewConstructorObjectValue {
    constructor(type: ArrayType, parameters: SemanticsValue[]) {
        super(type, parameters, SemanticsValueKind.NEW_ARRAY);
    }
}

export class NewArrayLenValue extends SemanticsValue {
    constructor(type: ArrayType, public readonly len: SemanticsValue) {
        super(SemanticsValueKind.NEW_ARRAY_LEN, type);
        this.shape = type.meta.originShape;
    }

    private _typeArguments?: ValueType[];

    setTypeArguments(typeArgs: ValueType[]) {
        this._typeArguments = typeArgs;
    }

    get typeArguments(): ValueType[] | undefined {
        return this._typeArguments;
    }
}

export class NewFromClassObjectValue extends NewConstructorObjectValue {
    constructor(
        type: ValueType,
        public readonly clazz: SemanticsValue,
        parameters: SemanticsValue[],
    ) {
        super(type, parameters, SemanticsValueKind.NEW_FROM_CLASS_OBJECT);
        if (type.kind == ValueTypeKind.OBJECT)
            this.shape = (type as ObjectType).instanceType!.meta.thisShape;
    }
}

export class BlockValue extends SemanticsValue {
    public values: SemanticsValue[] = [];
    public varList?: VarDeclareNode[];
    public refList?: VarDeclareNode[];
    public parent?: BlockValue;
    constructor(
        type: ValueType,
        public readonly label: string,
        public readonly isLoop: boolean = false,
        public readonly breakTarget: boolean = false,
    ) {
        super(SemanticsValueKind.BLOCK, type);
    }

    addHead(value: SemanticsValue) {
        this.values.unshift(value);
        if (value.kind == SemanticsValueKind.BLOCK)
            (value as BlockValue).parent = this;
    }

    addValue(value: SemanticsValue) {
        this.values.push(value);
        if (value.kind == SemanticsValueKind.BLOCK)
            (value as BlockValue).parent = this;
    }
}

export class BlockBranchValue extends SemanticsValue {
    constructor(public readonly target: BlockValue) {
        super(SemanticsValueKind.BLOCK_BRANCH, Primitive.Void);
    }
}

export class BlockBranchIfValue extends SemanticsValue {
    constructor(
        public readonly target: BlockBranchValue,
        public condition: SemanticsValue,
        public readonly trueBranch: boolean = false,
    ) {
        super(SemanticsValueKind.BLOCK_BRANCH_IF, Primitive.Void);
    }
}

export class ReturnValue extends SemanticsValue {
    constructor(public expr: SemanticsValue | undefined) {
        super(SemanticsValueKind.RET, expr ? expr.type : Primitive.Void);
    }
}

export class ReBindingValue extends SemanticsValue {
    constructor(public contextVar: VarDeclareNode) {
        super(SemanticsValueKind.REBINDING, Primitive.Void);
    }
}

export class SpreadValue extends SemanticsValue {
    constructor(type: ValueType, public target: SemanticsValue) {
        super(SemanticsValueKind.SPREAD, type);
    }
}

//////////////////////////////////
export function operatorString(kind: ts.BinaryOperator): string {
    switch (kind) {
        case ts.SyntaxKind.EqualsToken:
            return '=';
        case ts.SyntaxKind.PlusEqualsToken:
            return '+=';
        case ts.SyntaxKind.MinusEqualsToken:
            return '-=';
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
            return '**=';
        case ts.SyntaxKind.AsteriskEqualsToken:
            return '*=';
        case ts.SyntaxKind.SlashEqualsToken:
            return '/=';
        case ts.SyntaxKind.PercentEqualsToken:
            return '%=';
        case ts.SyntaxKind.AmpersandEqualsToken:
            return '&=';
        case ts.SyntaxKind.BarEqualsToken:
            return '|=';
        case ts.SyntaxKind.CaretEqualsToken:
            return '^=';
        case ts.SyntaxKind.LessThanLessThanEqualsToken:
            return '<<=';
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            return '>>>=';
        case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
            return '>>=';
        case ts.SyntaxKind.AsteriskAsteriskToken:
            return '**';
        case ts.SyntaxKind.AsteriskToken:
            return '*';
        case ts.SyntaxKind.SlashToken:
            return '/';
        case ts.SyntaxKind.PercentToken:
            return '%';
        case ts.SyntaxKind.PlusToken:
            return '+';
        case ts.SyntaxKind.MinusToken:
            return '-';
        case ts.SyntaxKind.CommaToken:
            return ',';
        case ts.SyntaxKind.LessThanLessThanToken:
            return '<<';
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
            return '>>';
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
            return '<<<';
        case ts.SyntaxKind.LessThanToken:
            return '<';
        case ts.SyntaxKind.LessThanEqualsToken:
            return '<=';
        case ts.SyntaxKind.GreaterThanToken:
            return '>';
        case ts.SyntaxKind.GreaterThanEqualsToken:
            return '>=';
        case ts.SyntaxKind.InstanceOfKeyword:
            return 'instance of';
        case ts.SyntaxKind.InKeyword:
            return 'in';
        case ts.SyntaxKind.EqualsEqualsToken:
            return '==';
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            return '===';
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            return '!==';
        case ts.SyntaxKind.ExclamationEqualsToken:
            return '!=';
        case ts.SyntaxKind.AmpersandToken:
            return '&';
        case ts.SyntaxKind.BarToken:
            return '|';
        case ts.SyntaxKind.CaretToken:
            return '^';
        case ts.SyntaxKind.AmpersandAmpersandToken:
            return '&&';
        case ts.SyntaxKind.BarBarToken:
            return '||';
        case ts.SyntaxKind.QuestionQuestionToken:
            return '??';
    }
    return ts.SyntaxKind[kind];
}
