/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { ObjectDescription, UnknownObjectDescription } from './runtime.js';
import {
    DefaultTypeId,
    MutabilityKind,
    NullabilityKind,
    PackedTypeKind,
    PredefinedTypeId,
} from '../utils.js';
import { BuiltinNames } from '../../lib/builtin/builtin_name.js';

export enum ValueTypeKind {
    PRIMITVE_BEGIN = 0,
    VOID,
    UNDEFINED,
    NULL,
    NEVER,
    INT,
    NUMBER,
    BOOLEAN,
    RAW_STRING,
    STRING,
    ANY,
    GENERIC, // the template generice type
    PRIMITVE_END,
    ARRAY,
    SET,
    MAP,
    OBJECT,
    INTERFACE,
    FUNCTION,
    UNION,
    INTERSECTION,
    NAMESPACE,
    CLOSURECONTEXT,
    EMPTY,
    TYPE_PARAMETER, // for template type parameter
    ENUM,
    TUPLE,
    WASM_I64,
    WASM_F32,
    WASM_ARRAY,
    WASM_STRUCT,
}

export class ValueType {
    constructor(public kind: ValueTypeKind, public typeId: number) {}

    equals(other: ValueType): boolean {
        if (this instanceof FunctionType) {
            if (this.kind != other.kind) return false;
            const other_func = other as unknown as FunctionType;
            if (!this.returnType.equals(other_func.returnType)) return false;
            if (this.argumentsType.length != other_func.argumentsType.length)
                return false;
            for (let i = 0; i < this.argumentsType.length; i++) {
                if (!this.argumentsType[i].equals(other_func.argumentsType[i]))
                    return false;
            }
            return true;
        } else {
            return this.kind == other.kind && other.typeId == this.typeId;
        }
    }

    toString(): string {
        return `ValueType[${ValueTypeKind[this.kind]}](${this.typeId})`;
    }

    private _generic_owner?: ValueType;

    private _builtin_type = false;
    private _primitive_type = false;
    private _wasm_type = false;

    get isBuiltin(): boolean {
        return this._builtin_type;
    }

    setBuiltin() {
        this._builtin_type = true;
    }

    get isPrimitive(): boolean {
        return this._primitive_type;
    }

    setPrimitive() {
        this._primitive_type = true;
    }

    get isWASM(): boolean {
        return this._wasm_type;
    }

    setWASM() {
        this._wasm_type = true;
    }

    setGenericOwner(vt: ValueType) {
        this._generic_owner = vt;
    }

    get genericOwner(): ValueType | undefined {
        return this._generic_owner;
    }

    isSpecialized(): boolean {
        return this._generic_owner != undefined && this._generic_owner != null;
    }

    get genericType(): ValueType {
        return this._generic_owner ? this._generic_owner : this;
    }
}

export type PrimitiveValueType =
    | number
    | boolean
    | string
    | null
    | undefined
    | never;

export class PrimitiveType extends ValueType {
    constructor(kind: ValueTypeKind, typeId: number) {
        super(kind, typeId);
        this.setPrimitive();
    }

    toString(): string {
        return `${ValueTypeKind[this.kind]}(${this.typeId})`;
    }
}

export const Primitive = {
    Void: new PrimitiveType(ValueTypeKind.VOID, PredefinedTypeId.VOID),
    Null: new PrimitiveType(ValueTypeKind.NULL, PredefinedTypeId.NULL),
    Undefined: new PrimitiveType(
        ValueTypeKind.UNDEFINED,
        PredefinedTypeId.UNDEFINED,
    ),
    Never: new PrimitiveType(ValueTypeKind.NEVER, PredefinedTypeId.NEVER),
    Boolean: new PrimitiveType(ValueTypeKind.BOOLEAN, PredefinedTypeId.BOOLEAN),
    Int: new PrimitiveType(ValueTypeKind.INT, PredefinedTypeId.INT),
    Number: new PrimitiveType(ValueTypeKind.NUMBER, PredefinedTypeId.NUMBER),
    RawString: new PrimitiveType(
        ValueTypeKind.RAW_STRING,
        PredefinedTypeId.RAW_STRING,
    ),
    String: new PrimitiveType(ValueTypeKind.STRING, PredefinedTypeId.STRING),
    Any: new PrimitiveType(ValueTypeKind.ANY, PredefinedTypeId.ANY),
    Generic: new PrimitiveType(ValueTypeKind.GENERIC, PredefinedTypeId.GENERIC),
    Namespace: new PrimitiveType(
        ValueTypeKind.NAMESPACE,
        PredefinedTypeId.NAMESPACE,
    ),
};

export class WASMType extends ValueType {
    constructor(kind: ValueTypeKind, typeId: number) {
        super(kind, typeId);
        this.setWASM();
    }

    toString(): string {
        return `${ValueTypeKind[this.kind]}(${this.typeId})`;
    }
}

export const WASM = {
    I32: new WASMType(ValueTypeKind.INT, PredefinedTypeId.INT),
    I64: new WASMType(ValueTypeKind.WASM_I64, PredefinedTypeId.WASM_I64),
    F32: new WASMType(ValueTypeKind.WASM_F32, PredefinedTypeId.WASM_F32),
    F64: new WASMType(ValueTypeKind.NUMBER, PredefinedTypeId.NUMBER),
    ANYREF: new WASMType(ValueTypeKind.ANY, PredefinedTypeId.ANY),
};

export class WASMArrayType extends WASMType {
    arrayType: ArrayType;
    packedTypeKind: PackedTypeKind = PackedTypeKind.Not_Packed;
    mutability: MutabilityKind = MutabilityKind.Mutable;
    nullability: NullabilityKind = NullabilityKind.Nullable;

    constructor(
        arrayType: ArrayType,
        packedTypeKind?: PackedTypeKind,
        mutability?: MutabilityKind,
        nullability?: NullabilityKind,
    ) {
        super(ValueTypeKind.WASM_ARRAY, PredefinedTypeId.WASM_ARRAY);
        this.arrayType = arrayType;
        if (packedTypeKind) {
            this.packedTypeKind = packedTypeKind;
        }
        if (mutability) {
            this.mutability = mutability;
        }
        if (nullability) {
            this.nullability = nullability;
        }
    }
}

export class WASMStructType extends WASMType {
    tupleType: TupleType;
    packedTypeKinds: PackedTypeKind[];
    mutabilitys: MutabilityKind[];
    nullability: NullabilityKind = NullabilityKind.Nullable;
    baseType: WASMStructType | undefined = undefined;

    constructor(
        tupleType: TupleType,
        packedTypeKinds?: PackedTypeKind[],
        mutabilitys?: MutabilityKind[],
        nullability?: NullabilityKind,
        baseType?: WASMStructType,
    ) {
        super(ValueTypeKind.WASM_STRUCT, PredefinedTypeId.WASM_STRUCT);
        this.tupleType = tupleType;
        if (packedTypeKinds) {
            this.packedTypeKinds = packedTypeKinds;
        } else {
            this.packedTypeKinds = new Array<PackedTypeKind>(
                this.tupleType.elements.length,
            );
            this.packedTypeKinds.fill(PackedTypeKind.Not_Packed);
        }
        if (mutabilitys) {
            this.mutabilitys = mutabilitys;
        } else {
            this.mutabilitys = new Array<MutabilityKind>(
                this.tupleType.elements.length,
            );
            this.mutabilitys.fill(MutabilityKind.Mutable);
        }
        if (nullability) {
            this.nullability = nullability;
        }
        this.baseType = baseType;
    }
}

export class EmptyType extends ValueType {
    constructor() {
        super(ValueTypeKind.EMPTY, PredefinedTypeId.EMPTY);
    }
}

export class ClosureContextType extends ValueType {
    constructor(
        public parentCtxType?: ClosureContextType,
        public freeVarTypeList: ValueType[] = [],
    ) {
        super(ValueTypeKind.CLOSURECONTEXT, PredefinedTypeId.CLOSURECONTEXT);
    }
}

export class ValueTypeWithArguments extends ValueType {
    constructor(kind: ValueTypeKind, typeId: number) {
        super(kind, typeId);
    }

    private _typeArguments?: TypeParameterType[];
    private _specialTypeArguments?: ValueType[];

    get hasUninitedTypeArguments(): boolean {
        return (
            this._typeArguments != undefined && this._typeArguments.length == 0
        );
    }

    addTypeParameter(type: TypeParameterType) {
        if (!this._typeArguments) this._typeArguments = [];
        if (this.kind == ValueTypeKind.FUNCTION) type.setOwnedByFunction();
        else if (
            this.kind == ValueTypeKind.OBJECT ||
            this.kind == ValueTypeKind.ARRAY
        )
            type.setOwnedByClass();
        this._typeArguments!.push(type);
    }

    setTypeArguments(types: TypeParameterType[]) {
        this._typeArguments = types;
    }

    get typeArguments(): TypeParameterType[] | undefined {
        return this._typeArguments;
    }

    inTypeArguments(valueType: ValueType): boolean {
        if (!this._typeArguments) return false;
        return !!this._typeArguments!.find((v) => v.equals(valueType));
    }

    setSpecialTypeArguments(types: ValueType[]) {
        this._specialTypeArguments = types;
    }

    get specialTypeArguments(): ValueType[] | undefined {
        return this._specialTypeArguments;
    }

    getSpecialTypeArg(type: TypeParameterType) {
        let typeIdx = -1;
        for (let i = 0; i < this.typeArguments!.length; i++) {
            if (this.typeArguments![i].name === type.name) {
                typeIdx = i;
            }
        }
        if (this.specialTypeArguments) {
            return this.specialTypeArguments![typeIdx];
        }
        return undefined;
    }

    getSpecialTypeArgs(types: TypeParameterType[]) {
        const specialTypeArgs: ValueType[] = [];
        for (const type of types) {
            specialTypeArgs.push(this.getSpecialTypeArg(type)!);
        }
        return specialTypeArgs;
    }
}

export class SetType extends ValueTypeWithArguments {
    constructor(
        typeId: number,
        public element: ValueType,
        public meta?: ObjectDescription,
    ) {
        super(ValueTypeKind.SET, typeId);
    }

    equals(other: ValueType): boolean {
        if (!super.equals(other)) return false;

        return (
            this.kind == other.kind &&
            this.element.equals((other as SetType).element)
        );
    }

    toString(): string {
        return `Set<${this.element.toString()}>(${this.typeId})`;
    }
}

export class MapType extends ValueTypeWithArguments {
    constructor(
        typeId: number,
        public key: ValueType,
        public value: ValueType,
        public meta?: ObjectDescription,
    ) {
        super(ValueTypeKind.MAP, typeId);
    }

    equals(other: ValueType): boolean {
        if (!super.equals(other)) return false;

        return (
            this.kind == other.kind &&
            this.key.equals((other as MapType).key) &&
            this.value.equals((other as MapType).value)
        );
    }

    toString(): string {
        return `Map<${this.key.toString()}, ${this.value.toString()}>(${
            this.typeId
        })`;
    }
}

export enum ObjectTypeFlag {
    OBJECT = 0, // normal object
    LITERAL,
    CLASS,
    UNION,
}

export class ObjectType extends ValueTypeWithArguments {
    public super?: ObjectType;
    public impl?: ObjectType; // not undefined iff it implement an interface
    private _class_or_instance?: ObjectType;
    private _numberIndexType?: ValueType;
    private _stringIndexType?: ValueType;
    private _implId = DefaultTypeId;

    constructor(
        typeId: number,
        public readonly meta: ObjectDescription,
        public readonly flags: number = 0,
        kind: ValueTypeKind = ValueTypeKind.OBJECT,
    ) {
        super(kind, typeId);
    }

    public isClassObject(): boolean {
        return this.flags == ObjectTypeFlag.CLASS;
    }
    public isLiteralObject(): boolean {
        return this.flags == ObjectTypeFlag.LITERAL;
    }
    public isObject(): boolean {
        return this.flags == ObjectTypeFlag.OBJECT;
    }

    public get classType(): ObjectType | undefined {
        if (this.isClassObject()) return this;
        if (this.isObject()) return this._class_or_instance;
        if (this.isLiteralObject()) return this.instanceType;
        return undefined;
    }
    public set classType(c: ObjectType | undefined) {
        if (this.isObject()) this._class_or_instance = c;
    }

    public get instanceType(): ObjectType | undefined {
        return this.isClassObject() ? this._class_or_instance : this;
    }

    public set instanceType(inst: ObjectType | undefined) {
        if (this.isClassObject()) this._class_or_instance = inst;
    }

    public get numberIndexType(): ValueType | undefined {
        return this._numberIndexType;
    }

    public setNumberIndexType(type: ValueType) {
        this._numberIndexType = type;
    }

    public get stringIndexType(): ValueType | undefined {
        return this._stringIndexType;
    }
    public setStringIndexType(type: ValueType) {
        this._stringIndexType = type;
    }

    public get implId() {
        return this._implId;
    }

    public set implId(id: number) {
        this._implId = id;
    }

    public clone(
        typeId: number,
        meta: ObjectDescription,
        flags: number,
        implId: number,
    ): ObjectType {
        const res = new ObjectType(typeId, meta, flags);
        res.implId = implId;
        return res;
    }

    equals(other: ValueType): boolean {
        //if (!super.equals(other)) return false;
        if (this.kind != other.kind) return false;

        const other_type = other as ObjectType;

        // if it is a comparison of two objectLiteral types, only need to determine whether their typeIds are the same.
        if (
            this.flags == ObjectTypeFlag.LITERAL &&
            other_type.flags == ObjectTypeFlag.LITERAL
        ) {
            if (this.typeId == other_type.typeId) return true;
            else return false;
        }

        if (this.meta === other_type.meta) return true;

        if (
            !this.typeArguments &&
            !other_type.typeArguments &&
            (this.genericOwner || other_type.genericOwner)
        ) {
            const self_generic = this.genericOwner
                ? (this.genericOwner as ObjectType)
                : this;
            const other_generic = other_type.genericOwner
                ? (other_type.genericOwner as ObjectType)
                : other_type;
            return self_generic.meta === other_generic.meta;
        }

        if (!(this.genericOwner && other_type.genericOwner)) return false;

        // is the same specialized object?
        if (!this.genericOwner!.equals(other_type.genericOwner!)) return false;
        // compare the specialTypeArguments
        if (
            this.specialTypeArguments &&
            other_type.specialTypeArguments &&
            this.specialTypeArguments.length ==
                other_type.specialTypeArguments.length
        ) {
            for (let i = 0; i < this.specialTypeArguments.length; i++) {
                if (
                    !this.specialTypeArguments[i].equals(
                        other_type.specialTypeArguments[i],
                    )
                ) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    toString(): string {
        return `ObjectType[${this.meta.name}:${ObjectTypeFlag[this.flags]}](${
            this.typeId
        })`;
    }
}

export class ArrayType extends ObjectType {
    constructor(typeId: number, meta: ObjectDescription, flags: number) {
        super(typeId, meta, flags, ValueTypeKind.ARRAY);
        this._element = Primitive.Undefined;
    }

    private _element: ValueType;

    setElement(element: ValueType) {
        this._element = element;
    }

    get element(): ValueType {
        if (this.numberIndexType) return this.numberIndexType;
        return this._element;
    }

    public get numberIndexType(): ValueType | undefined {
        if (super.numberIndexType) return super.numberIndexType;
        if (this.specialTypeArguments) return this.specialTypeArguments[0];

        if (this.isObject())
            return this.typeArguments ? this.typeArguments[0] : undefined;
        return undefined;
    }

    equals(other: ValueType): boolean {
        return (
            this.kind == other.kind &&
            this.element.equals((other as ArrayType).element)
        );
    }

    public clone(
        typeId: number,
        meta: ObjectDescription,
        flags: number,
    ): ObjectType {
        return new ArrayType(typeId, meta, flags);
    }

    toString(): string {
        return `Array<${this.element.toString()}(${
            this.isClassObject() ? 'CLASS' : 'OBJECT'
        })>(${this.typeId})`;
    }
}

export const UnknownObjectType = new ObjectType(
    DefaultTypeId,
    UnknownObjectDescription,
);

export class UnionType extends ValueType {
    constructor(
        typeId: number,
        public types: Set<ValueType>,
        public wideType: ValueType,
    ) {
        super(ValueTypeKind.UNION, typeId);
    }

    toString(): string {
        const ts: string[] = [];
        for (const t of this.types) {
            ts.push(t.toString());
        }
        return `[UNION{${this.wideType.toString()}} ${ts.join('|')}](${
            this.typeId
        })`;
    }

    equals(other: ValueType): boolean {
        if (!super.equals(other)) return false;

        if (this.kind != other.kind) return false;
        const other_union = other as UnionType;

        if (this.types.size != other_union.types.size) return false;

        for (const t of this.types) {
            let matched = other_union.types.has(t);
            if (!matched) {
                for (const o of other_union.types) {
                    if (o.equals(t)) {
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) return false;
        }
        return true;
    }
}

export class FunctionType extends ValueTypeWithArguments {
    constructor(
        typeId: number,
        public returnType: ValueType,
        public argumentsType: ValueType[],
        public isOptionalParams: boolean[] = [],
        public restParamIdx = -1,
        public envParamLen = BuiltinNames.envParamLen,
    ) {
        super(ValueTypeKind.FUNCTION, typeId);
    }

    getRestParam(): ValueType | undefined {
        if (this.restParamIdx < 0) return undefined;
        if (this.argumentsType.length <= 0) return Primitive.Any;
        const last_type = this.argumentsType[this.restParamIdx];
        if (last_type.kind == ValueTypeKind.ARRAY) {
            return (last_type as ArrayType).element;
        }
        return last_type;
    }

    hasParamType() {
        return this.restParamIdx >= 0;
    }

    getParamType(idx: number): ValueType | undefined {
        if (
            (this.hasParamType() && idx < this.restParamIdx) ||
            !this.hasParamType()
        ) {
            return this.argumentsType[idx];
        }
        return this.getRestParam();
    }

    equals(other: ValueType): boolean {
        if (this.kind != other.kind) return false;

        const other_func = other as FunctionType;
        if (!this.returnType.equals(other_func.returnType)) return false;
        if (this.argumentsType.length != other_func.argumentsType.length)
            return false;

        for (let i = 0; i < this.argumentsType.length; i++) {
            if (!this.argumentsType[i].equals(other_func.argumentsType[i]))
                return false;
        }
        return true;
    }

    toString(): string {
        const params: string[] = [];
        for (const p of this.argumentsType) {
            params.push(p.toString());
        }
        return `Function(${params.join(',')}) : ${this.returnType.toString()}`;
    }
}

enum TypeParameterOwnerType {
    FUNCTION,
    CLASS,
    CLOSURE,
}

export class TypeParameterType extends ValueType {
    private _ownerType: TypeParameterOwnerType =
        TypeParameterOwnerType.FUNCTION;
    private _specialTypeArgument?: ValueType;

    constructor(
        typeId: number,
        public readonly name: string,
        public readonly wideType: ValueType,
        public readonly index: number,
        public readonly defaultType?: ValueType,
    ) {
        super(ValueTypeKind.TYPE_PARAMETER, typeId);
    }

    setSpecialTypeArgument(type: ValueType) {
        this._specialTypeArgument = type;
    }

    get specialTypeArgument(): ValueType | undefined {
        return this._specialTypeArgument;
    }

    setOwnedByFunction() {
        this._ownerType = TypeParameterOwnerType.FUNCTION;
    }
    get ownedByFunction(): boolean {
        return this._ownerType == TypeParameterOwnerType.FUNCTION;
    }

    setOwnedByClass() {
        this._ownerType = TypeParameterOwnerType.CLASS;
    }
    get ownedByClass(): boolean {
        return this._ownerType == TypeParameterOwnerType.CLASS;
    }

    setOwnedByClosure() {
        this._ownerType = TypeParameterOwnerType.CLOSURE;
    }
    get ownedByClosure(): boolean {
        return this._ownerType == TypeParameterOwnerType.CLOSURE;
    }

    toString(): string {
        return `TypeParameter(${this.name}@${this.index} ${this.typeId}) Wide:${this.wideType} Default: ${this.defaultType}`;
    }

    equals(other: ValueType) {
        if (other.kind != ValueTypeKind.TYPE_PARAMETER) return false;
        if (this.typeId != -1 && other.typeId != -1) {
            return this.typeId == other.typeId;
        }
        if (!this.wideType.equals((other as TypeParameterType).wideType))
            return false;
        return true;
    }
}

export class EnumType extends ValueType {
    constructor(
        typeId: number,
        public name: string, // global name
        public memberType: ValueType,
        public members: Map<string, string | number>,
    ) {
        super(ValueTypeKind.ENUM, typeId);
    }

    toString(): string {
        let i = 0;
        let s = '';
        this.members.forEach((v, k) => {
            if (i < 4) {
                s += `${k}=${v},`;
                i++;
            } else if (i == 4) {
                s = s + '...';
            }
        });
        return `EnumType[${this.name}](${s})`;
    }
}

export class TupleType extends ValueType {
    constructor(typeId: number, public elements: ValueType[]) {
        super(ValueTypeKind.TUPLE, typeId);
    }

    toString(): string {
        const ts: string[] = [];
        for (const t of this.elements) {
            ts.push(t.toString());
        }
        return `[TUPLE{${this.elements.join(',')}}}](${this.typeId})`;
    }
}
