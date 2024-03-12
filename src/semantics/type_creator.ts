/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    Type,
    TSClass,
    FunctionKind,
    TypeKind,
    TSFunction,
    TSArray,
    TSUnion,
    TSTypeParameter,
    TSEnum,
    TSContext,
    TSTypeWithArguments,
    WasmArrayType,
    TSTuple,
    WasmStructType,
} from '../type.js';

import { InternalNames } from './internal.js';

import {
    IsBuiltInType,
    IsBuiltInTypeButAny,
    IsBuiltInObjectType,
    GetAndRemoveObjectSpecializeList,
    AddSpecializeObjectType,
    GetBuiltinObjectType,
    IsBuiltinObject,
    SpecializeInfo,
} from './builtin.js';

import { Logger } from '../log.js';

import {
    ValueType,
    ValueTypeKind,
    Primitive,
    ArrayType,
    UnionType,
    FunctionType,
    TypeParameterType,
    EnumType,
    ObjectType,
    ObjectTypeFlag,
    ClosureContextType,
    ValueTypeWithArguments,
    WASMArrayType,
    TupleType,
    WASMStructType,
} from './value_types.js';

import { BuildContext } from './builder_context.js';

import { SemanticsValue, VarValue, VarValueKind } from './value.js';

import { FunctionDeclareNode } from './semantics_nodes.js';

import {
    MemberType,
    ObjectDescription,
    ObjectDescriptionType,
    MemberDescription,
    MemberOrAccessor,
    Shape,
    ShapeMember,
    ShapeField,
    ShapeMethod,
    ShapeAccessor,
    Value,
    ShapeMemberStorage,
} from './runtime.js';
import { buildExpression, newCastValue } from './expression_builder.js';
import { DefaultTypeId } from '../utils.js';
import { BuiltinNames } from '../../lib/builtin/builtin_name.js';

export function isObjectType(kind: ValueTypeKind): boolean {
    return (
        kind == ValueTypeKind.OBJECT ||
        kind == ValueTypeKind.ARRAY ||
        kind == ValueTypeKind.SET ||
        kind == ValueTypeKind.MAP ||
        kind == ValueTypeKind.FUNCTION ||
        kind == ValueTypeKind.INTERSECTION
    );
}

export function isNullValueType(kind: ValueTypeKind): boolean {
    return (
        kind == ValueTypeKind.NULL ||
        kind == ValueTypeKind.UNDEFINED ||
        kind == ValueTypeKind.NEVER
    );
}

export function createArrayType(
    context: BuildContext,
    element_type: ValueType,
    arr_type?: Type,
): ArrayType {
    const array_type = context.module.findArrayValueType(element_type);
    if (array_type) return array_type as ArrayType;
    return specializeBuiltinObjectType('Array', [element_type])! as ArrayType;
}

export function createTupleType(
    context: BuildContext,
    element_types: ValueType[],
): TupleType {
    const tuple_type = context.module.findTupleElementTypes(element_types);
    if (tuple_type) {
        return tuple_type as TupleType;
    }
    return new TupleType(context.nextTypeId(), element_types);
}

function createTypeScores(): Map<ValueTypeKind, number> {
    const m = new Map<ValueTypeKind, number>();

    // the integer part mean the 'type class'
    // the decimal part mean the 'type level'
    // the types with same 'class' can cast each other
    // the same 'class' types have diffrent 'level'
    // the range of higher 'level' type, include the range of low 'level' type;

    m.set(ValueTypeKind.NUMBER, 1.6);
    m.set(ValueTypeKind.INT, 1.5);
    m.set(ValueTypeKind.BOOLEAN, 1.4);
    m.set(ValueTypeKind.STRING, 2.5);
    m.set(ValueTypeKind.RAW_STRING, 2.4);

    return m;
}

const type_scores = createTypeScores();

function collectWideTypes(types: Set<ValueType>): ValueType[] {
    const objectTypes: ValueType[] = [];
    let wideType: ValueType | undefined = undefined;

    for (const ty of types) {
        let t = ty;
        while (t) {
            if (t.kind == ValueTypeKind.UNION) {
                t = (t as UnionType).wideType;
                continue;
            }

            if (t.kind == ValueTypeKind.TYPE_PARAMETER) {
                t = (t as TypeParameterType).wideType;
                continue;
            }

            if (t.kind == ValueTypeKind.ENUM) {
                t = (t as EnumType).memberType;
                continue;
            }
            break;
        }

        if (t.kind == ValueTypeKind.NAMESPACE) {
            wideType = Primitive.Any;
            break;
        } else if (isObjectType(t.kind)) {
            objectTypes.push(t);
        }

        if (wideType == undefined) {
            wideType = t;
            continue;
        }

        if (wideType!.equals(t)) {
            continue;
        }

        if (wideType!.kind == ValueTypeKind.FUNCTION) {
            wideType = Primitive.Any; // TODO Fixed me, try find the same functions
            break;
        }

        if (isObjectType(t.kind) && isObjectType(wideType!.kind)) {
            continue;
        }

        if (
            t.kind == ValueTypeKind.VOID ||
            t.kind == ValueTypeKind.NULL ||
            t.kind == ValueTypeKind.UNDEFINED ||
            t.kind == ValueTypeKind.NEVER ||
            t.kind == ValueTypeKind.GENERIC // TODO maybe any type
        ) {
            continue;
        }

        const t_score = type_scores.get(t.kind);
        const wide_score = type_scores.get(wideType!.kind);
        if (t_score && wide_score) {
            /* eg. t.kind is ValueTypeKind.NUMBER,  wideType.kind is ValueTypeKind.INT

              so  t_score is 1.6,  wide_scope is 1.5

              because Math.floor(t_score ) == Math.floor(wide_scope) is true
              the `int` type and `number` type are same 'class',
              so, `int` type can cast to `number` type

              and, t_score > wide_score,
              wideType should be `number` type, because `number` has the hiegher 'level'
            */
            // if the integer part of scores are equal, the types are same 'class'
            if (Math.floor(t_score) == Math.floor(wide_score)) {
                if (t_score > wide_score) {
                    wideType = t; // use the higher 'level' type as wideType
                }
                continue;
            }
        }

        wideType = Primitive.Any;
        break;
    }

    if (!wideType) return [Primitive.Any];

    if (wideType.kind == ValueTypeKind.ANY) return [Primitive.Any];

    if (objectTypes.length == 0) {
        return [wideType];
    }

    return [Primitive.Any];
}

function createUnionInterfaceType(
    typeId: number,
    obj_types: ValueType[],
    context: BuildContext,
): ObjectType {
    const members = new Map<string, MemberDescription>();
    const obj_type = obj_types[0] as ObjectType;
    const meta = obj_type.isClassObject()
        ? obj_type.meta.instance!
        : obj_type.meta;
    for (const m of meta.members) {
        members.set(m.name, m);
    }

    for (let i = 1; i < obj_types.length; i++) {
        const obj_type = obj_types[i] as ObjectType;
        const meta = obj_type.isClassObject()
            ? obj_type.meta.instance!
            : obj_type.meta;
        for (const m of meta.members) {
            if (!members.has(m.name) || members.get(m.name)!.type != m.type) {
                members.delete(m.name); // delete the uncommon keys
            }
        }
    }

    const inst_members: MemberDescription[] = [];
    members.forEach((v, k) => {
        const m = new MemberDescription(
            v.name,
            v.type,
            inst_members.length,
            v.isOptional,
            v.valueType,
        );
        inst_members.push(m);
    });

    const inst_meta = new ObjectDescription(
        `@Union${typeId}`,
        ObjectDescriptionType.INTERFACE,
    );
    inst_meta.members = inst_members;
    createObjectDescriptionShapes(context, inst_meta);

    return new ObjectType(
        context.nextTypeId(),
        inst_meta,
        ObjectTypeFlag.UNION,
    );
}

export function createUnionType(
    context: BuildContext,
    element_types: Set<ValueType>,
    tsType?: Type,
): UnionType {
    const wide_type = CreateWideTypeFromTypes(context, element_types, tsType);
    return new UnionType(context.nextTypeId(), element_types, wide_type);
}

export function CreateWideTypeFromTypes(
    context: BuildContext,
    types: Set<ValueType>,
    tsType?: Type,
) {
    const wide_types = collectWideTypes(types);
    let wide_type = wide_types[0];

    if (wide_types.length > 1) {
        const typeId = context.nextTypeId();
        const inf_type = createUnionInterfaceType(typeId, wide_types, context);
        if (tsType) {
            context.module.typeByIds.set(typeId, inf_type);
        }
        wide_type = inf_type;
    }
    return wide_type;
}

function initTypeArguments(
    context: BuildContext,
    tstype: TSTypeWithArguments,
    value_type: ValueTypeWithArguments,
) {
    if (tstype.typeArguments) {
        for (const tp of tstype.typeArguments!) {
            const vtp = createType(context, tp) as TypeParameterType;
            value_type.addTypeParameter(vtp);
        }
    }
}

export function createType(
    context: BuildContext,
    type: Type,
    isObjectLiteral = false,
): ValueType {
    const module = context.module;
    let value_type = module.findValueTypeByType(type);
    if (value_type) return value_type; // do nothing

    switch (type.kind) {
        case TypeKind.CLASS:
            {
                value_type = createObjectType(type as TSClass, context)!;
            }
            break;
        case TypeKind.INTERFACE:
            {
                value_type = createObjectType(type as TSClass, context)!;
            }
            break;
        case TypeKind.ARRAY: {
            const arr = type as TSArray;
            const element_type = createType(context, arr.elementType);
            value_type = createArrayType(context, element_type, arr);
            break;
        }
        case TypeKind.FUNCTION: {
            const func = type as TSFunction;
            const retType = createType(context, func.returnType);
            const params: ValueType[] = [];
            for (const p of func.getParamTypes()) {
                params.push(createType(context, p));
            }

            value_type = new FunctionType(
                context.nextTypeId(),
                retType,
                params,
                func.isOptionalParams,
                func.restParamIdx,
            );
            break;
        }
        case TypeKind.UNION: {
            const unionType = type as TSUnion;
            const union_elements = new Set<ValueType>();
            unionType.types.forEach((t) =>
                union_elements.add(createType(context, t)),
            );
            value_type = createUnionType(context, union_elements, type);
            break;
        }
        case TypeKind.TYPE_PARAMETER: {
            const type_param = type as TSTypeParameter;
            const wideType = createType(context, type_param.wideType);
            const defaultType = type_param.defaultType
                ? createType(context, type_param.defaultType)
                : undefined;
            value_type = new TypeParameterType(
                context.nextTypeId(),
                type_param.name,
                wideType,
                type_param.index,
                defaultType,
            );
            break;
        }
        case TypeKind.ENUM: {
            const type_enum = type as TSEnum;
            const enum_type = new EnumType(
                context.nextTypeId(),
                `${context.getScopeNamespace()}|${type_enum.name}`,
                createType(context, type_enum.memberType),
                type_enum.members,
            );
            context.module.enums.set(enum_type.name, enum_type);
            value_type = enum_type;
            break;
        }
        case TypeKind.TUPLE: {
            const tsTuple = type as TSTuple;
            const tuple_elements: ValueType[] = [];
            for (const element_type of tsTuple.elements) {
                tuple_elements.push(createType(context, element_type));
            }
            const tuple_type = new TupleType(
                context.nextTypeId(),
                tuple_elements,
            );
            value_type = tuple_type;
            break;
        }
        case TypeKind.CONTEXT: {
            const contextType = type as TSContext;
            const parentCtxType = contextType.parentCtxType
                ? (createType(
                      context,
                      contextType.parentCtxType,
                  ) as ClosureContextType)
                : undefined;
            const freeVarTypeList: ValueType[] = [];
            for (const t of contextType.freeVarTypeList) {
                freeVarTypeList.push(createType(context, t));
            }
            value_type = new ClosureContextType(parentCtxType, freeVarTypeList);
            break;
        }
        case TypeKind.WASM_ARRAY: {
            const wasmArrayType = type as WasmArrayType;
            const arrayValueType = createType(
                context,
                wasmArrayType.arrayType,
            ) as ArrayType;
            value_type = new WASMArrayType(
                arrayValueType,
                wasmArrayType.packedTypeKind,
                wasmArrayType.mutability,
                wasmArrayType.nullability,
            );
            break;
        }
        case TypeKind.WASM_STRUCT: {
            const wasmStructType = type as WasmStructType;
            const structValueType = createType(
                context,
                wasmStructType.tupleType,
            ) as TupleType;
            value_type = new WASMStructType(
                structValueType,
                wasmStructType.packedTypeKinds,
                wasmStructType.mutabilitys,
                wasmStructType.nullability,
                wasmStructType.baseType
                    ? (createType(
                          context,
                          wasmStructType.baseType,
                      ) as WASMStructType)
                    : undefined,
            );
            break;
        }
    }

    if (value_type) {
        context.module.types.set(type, value_type);
        context.module.typeByIds.set(value_type.typeId, value_type);
    } else {
        value_type = Primitive.Any;
    }

    context.globalSymbols.set(type, value_type!);

    if (
        type instanceof TSTypeWithArguments &&
        value_type instanceof ValueTypeWithArguments
    ) {
        initTypeArguments(
            context,
            type as TSTypeWithArguments,
            value_type as ValueTypeWithArguments,
        );
    }

    return value_type!;
}

function handleRecType(
    context: BuildContext,
    clazz: TSClass,
    inst_type: ObjectType,
) {
    /** the frontend will only generate single tsclass for object type, so here we can determine whether the type is
     * belong to rec group
     */
    for (let i = 0; i < context.recClassTypeGroup.length; ++i) {
        const row = context.recClassTypeGroup[i];
        const col = row.indexOf(clazz);
        if (col !== -1) {
            context.module.recObjectTypeGroup[i][col] = inst_type;
        }
    }
}

export function createObjectType(
    clazz: TSClass,
    context: BuildContext,
): ObjectType | undefined {
    const objectType = context.module.findObjectValueType(clazz);
    if (objectType) {
        return objectType as ObjectType;
    }
    // filter out useless class types
    if (
        clazz.typeKind == TypeKind.CLASS &&
        !clazz.isLiteral &&
        !clazz.belongedScope
    ) {
        return undefined;
    }
    if (clazz.mangledName.includes(BuiltinNames.builtinTypeManglePrefix)) {
        if (IsBuiltinObject(clazz.className)) {
            return createBuiltinObjectType(clazz, context);
        }
    }
    let mangledName = clazz.mangledName;
    if (mangledName.length == 0) mangledName = clazz.className;
    const instName = mangledName;
    const clazzName = InternalNames.getClassMetaName(mangledName);

    const exist_type = context.getNamedValueType(instName);
    if (exist_type) return exist_type as ObjectType;

    let instance_type = ObjectDescriptionType.OBJECT_INSTANCE;
    if (clazz.isLiteral) instance_type = ObjectDescriptionType.OBJECT_LITERAL;
    else if (clazz.kind == TypeKind.INTERFACE)
        instance_type = ObjectDescriptionType.INTERFACE;

    const base_class = clazz.getBase();
    const impl_infc = clazz.getImplInfc();
    let base_type: ObjectType | undefined = undefined;
    let impl_type: ObjectType | undefined = undefined;

    if (base_class) base_type = createObjectType(base_class, context);
    if (impl_infc) impl_type = createObjectType(impl_infc, context);

    // TODO use className as instanceName
    const inst_meta = new ObjectDescription(instName, instance_type);
    let clazz_meta: ObjectDescription | undefined = undefined;

    if (base_type) inst_meta.base = base_type.instanceType!.meta;

    context.objectDescriptions.set(inst_meta.name, inst_meta);

    const inst_type = new ObjectType(
        clazz.typeId,
        inst_meta,
        clazz.isLiteral ? ObjectTypeFlag.LITERAL : ObjectTypeFlag.OBJECT,
    );
    context.metaAndObjectTypeMap.set(inst_meta, inst_type);
    inst_type.implId = DefaultTypeId;
    if (impl_infc) {
        inst_type.implId = impl_infc.typeId;
    } else if (base_class) {
        let sup_class: TSClass | null = base_class;
        while (sup_class) {
            const temp_impl_infc = sup_class.getImplInfc();
            if (temp_impl_infc) {
                inst_type.implId = temp_impl_infc.typeId;
                break;
            }
            sup_class = sup_class.getBase();
        }
    }

    let genericOwner: ObjectType | undefined;
    if (clazz.genericOwner) {
        genericOwner = context.module.findValueTypeByType(
            clazz.genericOwner,
        ) as ObjectType;
        if (genericOwner) {
            inst_type.setGenericOwner(genericOwner.instanceType!);
        }
    }

    if (inst_meta.isObjectInstance) {
        clazz_meta = new ObjectDescription(
            clazzName,
            ObjectDescriptionType.OBJECT_CLASS,
        );
        if (base_type) {
            clazz_meta.base = base_type.classType!.meta;
            inst_type.super = base_type;
        }
        inst_type.impl = impl_type ?? undefined;

        clazz_meta.instance = inst_meta;
        inst_meta.clazz = clazz_meta;

        context.objectDescriptions.set(clazzName, clazz_meta);
        const clazz_type = new ObjectType(
            clazz.typeId + 1,
            clazz_meta,
            ObjectTypeFlag.CLASS,
        );
        context.metaAndObjectTypeMap.set(clazz_meta, clazz_type);
        clazz_type.implId = inst_type.implId;

        clazz_type.instanceType = inst_type;
        inst_type.classType = clazz_type;
        if (genericOwner) {
            clazz_type.setGenericOwner(genericOwner.classType!);
        }
    }

    // set the index signature
    if (clazz.numberIndexType) {
        inst_type.setNumberIndexType(
            createType(context, clazz.numberIndexType),
        );
    }
    if (clazz.stringIndexType) {
        inst_type.setStringIndexType(
            createType(context, clazz.stringIndexType),
        );
    }

    context.setNamedValueType(mangledName, inst_type);

    context.pushTask(() =>
        updateMemberDescriptions(context, clazz, inst_meta, clazz_meta),
    );
    handleRecType(context, clazz, inst_type);
    return inst_type;
}

function createBuiltinObjectType(
    clazz: TSClass,
    context: BuildContext,
): ObjectType {
    const obj_type = GetBuiltinObjectType(clazz.className);

    if (obj_type.meta.isInited) return obj_type;

    if (obj_type.isObject())
        context.setNamedValueType(obj_type.meta.name, obj_type);

    if (clazz.typeKind == TypeKind.INTERFACE || clazz.isLiteral)
        context.pushTask(() =>
            updateMemberDescriptions(
                context,
                clazz,
                obj_type.meta,
                undefined,
                false,
            ),
        );
    else
        context.pushTask(() =>
            updateMemberDescriptions(
                context,
                clazz,
                obj_type.instanceType!.meta,
                obj_type.classType!.meta,
                false,
            ),
        );

    context.objectDescriptions.set(obj_type.meta.name, obj_type.meta);

    handleRecType(context, clazz, obj_type);

    return obj_type;
}

interface ClassMemberCount {
    static_count: number;
    inst_count: number;
}

function getClassMemberCount(clazz: TSClass): ClassMemberCount {
    let static_count = clazz.staticFields.length;
    let inst_count = clazz.fields.length;
    const is_interface = clazz.typeKind == TypeKind.INTERFACE;

    const accessor_names = new Set<string>();

    if (!is_interface && clazz.ctorType) {
        static_count++;
    }

    for (const m of clazz.memberFuncs) {
        if (m.type.funcKind == FunctionKind.CONSTRUCTOR) {
            /* This branch will never be reached since constructor has not been stored int members */
            if (is_interface) inst_count++;
            else static_count++;
        } else if (m.type.funcKind == FunctionKind.STATIC) {
            static_count++;
        } else {
            if (
                m.type.funcKind == FunctionKind.GETTER ||
                m.type.funcKind == FunctionKind.SETTER
            ) {
                if (!accessor_names.has(m.name)) {
                    inst_count++;
                    accessor_names.add(m.name);
                }
            } else {
                inst_count++;
            }
        }
    }

    return <ClassMemberCount>{ static_count, inst_count };
}

function getGlobalFunction(
    context: BuildContext,
    globalName: string,
): Value | undefined {
    const value = context.getGlobalValue(globalName);
    if (value && (value as VarValue).ref instanceof FunctionDeclareNode) {
        return value as VarValue;
    }

    return undefined;
}

function updateMemberDescriptions(
    context: BuildContext,
    clazz: TSClass,
    inst_meta: ObjectDescription,
    clazz_meta?: ObjectDescription,
    is_base = false,
) {
    if (inst_meta.isInited) return;

    let inst_idx = 0;
    const is_interface = clazz.kind == TypeKind.INTERFACE;

    const base = clazz.getBase();
    if (base) {
        updateMemberDescriptions(
            context,
            base,
            inst_meta.base!,
            clazz_meta?.base,
            true,
        );
        inst_idx = inst_meta.base?.members.length || 0;
    }

    let inst_offset = inst_meta.base ? inst_meta.base!.fieldCount : 0;
    let class_idx = 0;
    let clazz_offset = 0;
    if (clazz_meta) {
        clazz_offset = clazz_meta.base ? clazz_meta.base!.fieldCount : 0;
    }
    const is_instance = !!clazz_meta;

    const counts = getClassMemberCount(clazz);
    inst_meta.members = new Array(counts.inst_count);
    if (clazz_meta) clazz_meta.members = new Array(counts.static_count);

    for (const f of clazz.fields) {
        const is_optional = f.optional == undefined ? false : f.optional;
        const value_type = createType(context, f.type);
        const member = inst_meta.updateMember(
            f.name,
            inst_idx,
            MemberType.FIELD,
            is_optional,
            value_type,
            true,
        );
        member.offset = member.index;
        if (member.index === inst_idx) {
            inst_idx++;
        }
    }

    if (clazz_meta) {
        clazz_meta.setInited();
        for (const f of clazz.staticFields) {
            const is_optional = f.optional == undefined ? false : f.optional;
            const value_type = createType(context, f.type);
            const staticInitExpr =
                clazz.staticFieldsInitValueMap.get(class_idx);
            let staticInitValue: SemanticsValue | undefined = undefined;
            if (staticInitExpr) {
                staticInitValue = buildExpression(staticInitExpr, context);

                if (!staticInitValue.type.equals(value_type)) {
                    staticInitValue = newCastValue(value_type, staticInitValue);
                }
            }
            const member = clazz_meta.updateMember(
                f.name,
                class_idx++,
                MemberType.FIELD,
                is_optional,
                value_type,
                true,
                undefined,
                true,
                staticInitValue,
            );
            member.offset = member.index;
        }
    }

    if (!is_base && clazz_meta) {
        const ctor = clazz.ctorType;
        if (ctor) {
            const ctor_type = createType(context, ctor);
            /* TODO: add ctor in a seperate field, can be deleted later */
            const ctorMember = new MemberDescription(
                InternalNames.CONSTRUCTOR,
                MemberType.CONSTRUCTOR,
                -1,
                false,
                ctor_type,
                {
                    method: getGlobalFunction(
                        context,
                        `${clazz.mangledName}|${InternalNames.CONSTRUCTOR}`,
                    ),
                },
            );
            ctorMember.isDeclaredCtor = clazz.hasDeclareCtor;
            clazz_meta.ctor = ctorMember;
            if (clazz_meta.instance) {
                clazz_meta.instance.ctor = ctorMember;
            }
            /* put ctor into clazz members */
            const member = clazz_meta.updateMember(
                InternalNames.CONSTRUCTOR,
                class_idx++,
                MemberType.CONSTRUCTOR,
                false,
                ctor_type,
                true,
                {
                    method: getGlobalFunction(
                        context,
                        `${clazz.mangledName}|${InternalNames.CONSTRUCTOR}`,
                    ),
                },
            );
            member.offset = clazz_offset++;
        }
    }

    for (const m of clazz.memberFuncs) {
        const value_type = createType(context, m.type);
        const is_optional = m.optional == undefined ? false : m.optional;
        Logger.debug(
            `=== member method:${m.name} ${m.type.funcKind}  ${value_type}`,
        );
        if (m.type.funcKind == FunctionKind.CONSTRUCTOR) {
            if (is_interface || (!is_base && clazz_meta)) {
                // add the constructor type
                const meta = is_interface ? inst_meta : clazz_meta!;
                const member = meta.updateMember(
                    InternalNames.CONSTRUCTOR,
                    is_interface ? inst_idx++ : class_idx++,
                    MemberType.METHOD,
                    is_optional,
                    value_type,
                    true,
                    {
                        method: getGlobalFunction(
                            context,
                            `${clazz.mangledName}|${InternalNames.CONSTRUCTOR}`,
                        ),
                    },
                );
                member.offset = is_interface ? inst_offset++ : clazz_offset++;
            }
        } else if (m.type.funcKind == FunctionKind.STATIC) {
            if (clazz_meta) {
                const is_override_or_own = clazz.overrideOrOwnMethods.has(
                    m.name,
                );
                const member = clazz_meta.updateMember(
                    m.name,
                    class_idx++,
                    MemberType.METHOD,
                    is_optional,
                    value_type,
                    is_override_or_own,
                    {
                        method: getGlobalFunction(
                            context,
                            `${clazz.mangledName}|@${m.name}`,
                        ),
                    },
                    true,
                );
                member.offset = member.index;
            }
        } else if (
            m.type.funcKind == FunctionKind.GETTER ||
            m.type.funcKind == FunctionKind.SETTER
        ) {
            const is_setter = m.type.funcKind == FunctionKind.SETTER;
            const name = `${is_setter ? 'set_' : 'get_'}${m.name}`;
            const globalName = is_interface
                ? `${clazz.className}|${name}`
                : `${clazz.mangledName}|${name}`;
            const func = is_interface
                ? undefined
                : getGlobalFunction(context, globalName);

            const is_override_or_own = clazz.overrideOrOwnMethods.has(name);
            let accessor = inst_meta.findMember(m.name);
            const field_type = getAccessorType(
                globalName,
                value_type,
                is_setter,
            );
            if (!accessor) {
                // get the result type
                accessor = inst_meta.updateMember(
                    m.name,
                    inst_idx,
                    MemberType.ACCESSOR,
                    is_optional,
                    field_type,
                    is_override_or_own,
                );
                if (accessor.index === inst_idx) {
                    inst_idx++;
                }
            } else {
                if (
                    accessor.valueType.kind == ValueTypeKind.ANY &&
                    field_type.kind != ValueTypeKind.ANY
                ) {
                    accessor.valueType = field_type;
                }
            }
            if (is_setter) {
                accessor.setterType = field_type;
            } else {
                accessor.getterType = field_type;
            }

            if (func) {
                accessor.setAccessorFunction(func, is_setter);
            } else {
                // when 'func' is empty, it means that the current getter/setter is inherited from the base class
                if (!is_interface) {
                    let baseClass = clazz.getBase();
                    while (baseClass) {
                        const globalMethodName = `${baseClass.mangledName}|${name}`;
                        const funcValue = getGlobalFunction(
                            context,
                            globalMethodName,
                        );
                        if (funcValue) {
                            if (
                                (is_setter && !accessor.hasSetter) ||
                                (!is_setter && !accessor.hasGetter)
                            ) {
                                accessor.setAccessorFunction(
                                    funcValue,
                                    is_setter,
                                );
                            }
                            break;
                        }
                        baseClass = baseClass.getBase();
                    }
                }
            }
            if (!is_instance) {
                if (is_setter) accessor.setterOffset = inst_offset;
                else accessor.getterOffset = inst_offset;
                inst_offset++;
            }
        } else {
            // method, in prototype
            const is_override_or_own = clazz.overrideOrOwnMethods.has(m.name);
            const member = inst_meta.updateMember(
                m.name,
                inst_idx,
                MemberType.METHOD,
                is_optional,
                value_type,
                is_override_or_own,
                is_interface
                    ? undefined
                    : {
                          method: getGlobalFunction(
                              context,
                              `${clazz.mangledName}|${m.name}`,
                          ),
                      },
            );
            if (!is_instance) {
                member.offset = inst_offset++;
            }
            if (member.index === inst_idx) {
                inst_idx++;
            }
        }
    }

    inst_meta.fieldCount = inst_offset;

    if (clazz_meta) clazz_meta.fieldCount = clazz_offset;

    inst_meta.setInited();
}

function getAccessorType(
    name: string,
    vt: ValueType,
    is_setter: boolean,
): ValueType {
    if (vt.kind == ValueTypeKind.FUNCTION) {
        const func_type = vt as FunctionType;
        let type = Primitive.Any;
        if (is_setter) {
            const params = func_type.argumentsType;
            // get the last params
            type = params[params.length - 1];
        } else {
            type = func_type.returnType;
        }
        if (
            !type ||
            type.kind == ValueTypeKind.UNDEFINED ||
            type.kind == ValueTypeKind.NULL ||
            type.kind == ValueTypeKind.VOID
        ) {
            Logger.warn(
                `[WARNING] ${name} ${
                    is_setter ? 'SETTER' : 'GETTER'
                }:  ${vt} need a right type ${type}`,
            );

            return Primitive.Any;
        }

        return type;
    }
    return vt;
}

export function createObjectDescriptionShapes(
    context: BuildContext,
    meta: ObjectDescription,
) {
    if (meta.originShape) return;

    const shape = new Shape(meta);
    meta.originShape = shape;
    const members = new Array(meta.members.length);
    shape.members = members;

    const is_instance = meta.type == ObjectDescriptionType.OBJECT_INSTANCE;
    const is_Literal = meta.type == ObjectDescriptionType.OBJECT_LITERAL;
    for (let i = 0; i < meta.members.length; i++) {
        const m = meta.members[i];
        if (is_instance || is_Literal) {
            if (m.type == MemberType.FIELD) {
                members[i] = new ShapeField(m.offset);
            } else if (m.methodOrAccessor) {
                members[i] = CreateShapeMemberValue(m, context);
            }
        } else {
            const sm = CreateShapeMember(m);
            if (sm) members[i] = sm;
        }
    }

    if (is_instance && meta.drived > 0) {
        const this_shape = new Shape(meta);
        const this_members = new Array<ShapeMember>(members.length);
        this_shape.members = this_members;
        for (let i = 0; i < members.length; i++) {
            if (members[i].kind == MemberType.FIELD)
                this_members[i] = members[i];
            else {
                // TODO check private method
            }
        }
        meta.thisShape = this_shape;
    } else if (meta.type == ObjectDescriptionType.INTERFACE) {
        // create a shape with null members
        const this_shape = new Shape(meta);
        const this_members = new Array<ShapeMember>(members.length);
        this_shape.members = this_members;
        meta.thisShape = this_shape;
    } else {
        meta.thisShape = shape;
    }
}

function CreateShapeMember(member: MemberDescription): ShapeMember | undefined {
    switch (member.type) {
        case MemberType.FIELD:
            return new ShapeField(member.offset);
        case MemberType.ACCESSOR:
            return new ShapeAccessor(
                ShapeMemberStorage.OFFSET,
                member.getterOffset,
                member.setterOffset,
            );
        case MemberType.METHOD:
            return new ShapeMethod(ShapeMemberStorage.OFFSET, member.offset);
    }
    return undefined;
}

function CreateShapeMemberValue(
    member: MemberDescription,
    context: BuildContext,
): ShapeMember | undefined {
    switch (member.type) {
        case MemberType.ACCESSOR: {
            return new ShapeAccessor(
                ShapeMemberStorage.VALUE,
                member.getter,
                member.setter,
            );
        }
        case MemberType.METHOD:
            return new ShapeMethod(ShapeMemberStorage.VALUE, member.method);
    }
    return undefined;
}

function specializeValue(
    mapper: SpecializeTypeMapper,
    value?: Value,
): Value | undefined {
    if (!value) return undefined;

    if (value instanceof VarValue) {
        const var_value = value as VarValue;
        return new VarValue(
            var_value.kind as VarValueKind,
            mapper.getValueType(var_value.type),
            var_value.ref,
            var_value.index,
        );
    }

    return value;
}

function specializeMemberDescription(
    m: MemberDescription,
    mapper: SpecializeTypeMapper,
): MemberDescription {
    const methodOrAccessor = m.methodOrAccessor;
    let newMemberOrAccessor: MemberOrAccessor | undefined = undefined;
    if (methodOrAccessor) {
        newMemberOrAccessor = {};
        newMemberOrAccessor!.method = specializeValue(
            mapper,
            methodOrAccessor.method,
        );
        newMemberOrAccessor!.getter = specializeValue(
            mapper,
            methodOrAccessor.getter,
        );
        newMemberOrAccessor!.setter = specializeValue(
            mapper,
            methodOrAccessor.setter,
        );
    }

    return new MemberDescription(
        m.name,
        m.type,
        m.index,
        m.isOptional,
        mapper.getValueType(m.valueType),
        newMemberOrAccessor,
    );
}

function simpleCopyShape(
    meta: ObjectDescription,
    shape?: Shape,
): Shape | undefined {
    if (shape) {
        const new_shape = new Shape(meta, shape);
        new_shape.members = shape.members;
        return new_shape;
    }
    return undefined;
}

function initSpecializeObjectDescription(
    mapper: SpecializeTypeMapper,
    meta: ObjectDescription,
    self_meta: ObjectDescription,
) {
    self_meta.base = meta.base;
    self_meta.fieldCount = meta.fieldCount;
    self_meta.drived = meta.drived;
    self_meta.originShape = simpleCopyShape(self_meta, meta.originShape);
    self_meta.thisShape =
        meta.thisShape === meta.originShape
            ? self_meta.originShape
            : simpleCopyShape(self_meta, meta.thisShape);

    self_meta.setInited();

    self_meta.members = [];
    // init all members
    for (const m of meta.members) {
        self_meta.members.push(specializeMemberDescription(m, mapper));
    }

    if (meta.isObjectClass) {
        const inst_meta = specializeObjectDescription(mapper, meta.instance);
        self_meta.instance = inst_meta;
        if (inst_meta) inst_meta.clazz = self_meta;
    }
}

function specializeObjectDescription(
    mapper: SpecializeTypeMapper,
    meta?: ObjectDescription,
): ObjectDescription | undefined {
    if (!meta) return undefined;

    const self_meta = new ObjectDescription(meta!.name, meta!.type, meta!);

    if (meta.isBuiltin) self_meta.setBuiltin();

    if (meta.isInited && meta.originShape)
        initSpecializeObjectDescription(mapper, meta!, self_meta);

    return self_meta;
}

function specializeIndexType(
    mapper: SpecializeTypeMapper,
    obj_type: ObjectType,
    indexType: ValueType,
): ValueType {
    if (
        indexType.kind == ValueTypeKind.TYPE_PARAMETER &&
        obj_type.inTypeArguments(indexType)
    ) {
        return mapper.getValueType(indexType);
    }

    return mapper.getValueType(indexType);
}

function initIndexType(
    mapper: SpecializeTypeMapper,
    obj_type: ObjectType,
    special_type: ObjectType,
) {
    if (obj_type.numberIndexType) {
        special_type.setNumberIndexType(
            specializeIndexType(mapper, obj_type, obj_type.numberIndexType),
        );
    }

    if (obj_type.stringIndexType) {
        special_type.setStringIndexType(
            specializeIndexType(mapper, obj_type, obj_type.stringIndexType),
        );
    }
}

export class SpecializeTypeMapper {
    typeMap = new Map<TypeParameterType, ValueType>();
    specializedMap = new Map<ValueType, ValueType>();

    ownerType: ValueTypeWithArguments;

    constructor(owner: ValueTypeWithArguments, typeArgs: ValueType[]) {
        this.ownerType = owner;
        this.initTypeArguments(typeArgs);
    }

    initTypeArguments(typeArgs: ValueType[]) {
        const typeTypeParams = this.ownerType.typeArguments;
        if (!typeTypeParams || typeTypeParams.length == 0) return;

        let i = 0;
        for (; i < typeTypeParams.length && i < typeArgs.length; i++) {
            this.typeMap.set(typeTypeParams[i], typeArgs[i]);
        }

        for (; i < typeTypeParams.length; i++) {
            const def_type = typeTypeParams[i].defaultType;
            if (def_type) {
                this.typeMap.set(typeTypeParams[i], def_type);
            }
        }
    }

    getValueType(valueType: ValueType): ValueType {
        if (valueType.kind == ValueTypeKind.TYPE_PARAMETER) {
            const vt = this.typeMap.get(valueType as TypeParameterType);
            if (vt) return vt;
            return valueType;
        }
        const vt = this.specializedMap.get(valueType);
        if (vt) {
            return vt;
        }

        return this.specializeValueType(valueType);
    }

    updateObjectSpecialTypeArguments(obj_type: ObjectType) {
        const typeArguments = (obj_type.genericOwner! as ObjectType)
            .typeArguments;
        if (typeArguments) {
            const typeArgs: ValueType[] = [];
            for (const type of typeArguments) {
                const special_type = this.getValueType(type);
                typeArgs.push(special_type);
            }
            obj_type.setSpecialTypeArguments(typeArgs);
        }
    }

    updateObjectTypeArguments(obj_type: ObjectType, special_type: ObjectType) {
        initIndexType(this, obj_type, special_type);
        if (special_type != obj_type) {
            special_type.setGenericOwner(obj_type);
            if (obj_type.typeArguments) {
                special_type.setTypeArguments(obj_type.typeArguments!);
            }
        }
    }

    specializeValueType(valueType: ValueType): ValueType {
        let special_type: ValueType = valueType;
        switch (valueType.kind) {
            case ValueTypeKind.ARRAY:
            case ValueTypeKind.OBJECT: {
                let obj_type = valueType as ObjectType;
                if (
                    obj_type.isClassObject() ||
                    (obj_type.isObject() && obj_type.classType)
                ) {
                    if (obj_type.isObject()) {
                        obj_type = obj_type.classType!;
                    }
                    const self_meta = new ObjectDescription(
                        obj_type.meta.name,
                        obj_type.meta.type,
                        obj_type.meta,
                    );
                    const self = obj_type.clone(
                        DefaultTypeId,
                        self_meta,
                        obj_type.flags,
                        obj_type.implId,
                    );
                    // create instance
                    const self_inst_meta = new ObjectDescription(
                        obj_type.instanceType!.meta.name,
                        obj_type.instanceType!.meta.type,
                        obj_type.instanceType!.meta,
                    );
                    const inst = obj_type.instanceType!.clone(
                        DefaultTypeId,
                        self_inst_meta,
                        ObjectTypeFlag.OBJECT,
                        obj_type.instanceType!.implId,
                    );
                    inst.classType = self;
                    self.instanceType = inst;
                    self_inst_meta.clazz = self_meta;
                    self_meta.instance = self_inst_meta;
                    self.setGenericOwner(obj_type);
                    inst.setGenericOwner(obj_type.instanceType!);
                    this.specializedMap.set(obj_type, self);
                    this.specializedMap.set(obj_type.instanceType!, inst);
                    this.updateObjectSpecialTypeArguments(self);
                    this.updateObjectSpecialTypeArguments(inst);

                    special_type = inst;
                    if (obj_type.meta.isInited && obj_type.meta.originShape)
                        initSpecializeObjectDescription(
                            this,
                            obj_type.meta,
                            self_meta,
                        );
                    if (
                        obj_type.instanceType!.meta.isInited &&
                        obj_type.instanceType!.meta.originShape
                    )
                        initSpecializeObjectDescription(
                            this,
                            obj_type.instanceType!.meta,
                            self_inst_meta,
                        );
                } else {
                    const self_meta = new ObjectDescription(
                        obj_type.meta.name,
                        obj_type.meta.type,
                        obj_type.meta,
                    );
                    special_type = obj_type.clone(
                        DefaultTypeId,
                        self_meta,
                        obj_type.flags,
                        obj_type.implId,
                    );

                    special_type.setGenericOwner(obj_type);
                    this.specializedMap.set(obj_type, special_type);
                    this.updateObjectSpecialTypeArguments(
                        special_type as ObjectType,
                    );
                    if (obj_type.meta.isInited && obj_type.meta.originShape)
                        initSpecializeObjectDescription(
                            this,
                            obj_type.meta,
                            self_meta,
                        );
                }

                initIndexType(
                    this,
                    valueType as ObjectType,
                    special_type as ObjectType,
                );
                break;
            }
            case ValueTypeKind.FUNCTION: {
                const func_type = valueType as FunctionType;
                const ret_type = this.getValueType(func_type.returnType);
                let need_special = !ret_type.equals(func_type.returnType);
                const args: ValueType[] = [];
                for (const p of func_type.argumentsType) {
                    const arg = this.getValueType(p);
                    need_special = need_special || !arg.equals(p);
                    args.push(arg);
                }
                if (need_special) {
                    special_type = new FunctionType(
                        -1,
                        ret_type,
                        args,
                        func_type.isOptionalParams,
                        func_type.restParamIdx,
                    );
                    this.specializedMap.set(valueType, special_type);
                }
                break;
            }
        }
        if (special_type !== valueType) {
            special_type.setGenericOwner(valueType);

            if (valueType.isBuiltin) {
                special_type.setBuiltin();
            }

            if (special_type instanceof ValueTypeWithArguments) {
                if (special_type !== this.ownerType) {
                    if ((valueType as ValueTypeWithArguments).typeArguments)
                        (
                            special_type as ValueTypeWithArguments
                        ).setTypeArguments(
                            (valueType as ValueTypeWithArguments)
                                .typeArguments!,
                        );
                }
            }
        }
        return special_type;
    }
}

function initBuiltinObjectTypeDescriptions(
    mapper: SpecializeTypeMapper,
    type: ObjectType,
    special_type: ObjectType,
    typeArgs: ValueType[],
    need_update_type_args: boolean,
) {
    if (need_update_type_args) {
        mapper.initTypeArguments(typeArgs);
        mapper.updateObjectTypeArguments(type, special_type);
    }

    initSpecializeObjectDescription(
        mapper,
        type.instanceType!.meta,
        special_type.instanceType!.meta,
    );
    initSpecializeObjectDescription(
        mapper,
        type.classType!.meta,
        special_type.classType!.meta,
    );
}

export function specializeBuiltinObjectType(
    name: string,
    typeArgs: ValueType[],
): ObjectType | undefined {
    const type = GetBuiltinObjectType(name);
    if (!type) return undefined;

    if (!type.typeArguments) return type;

    const mapper = new SpecializeTypeMapper(type, typeArgs);
    // Array Type: may get ArrayType<any> before define the ArrayType
    const need_update_type_args = type.hasUninitedTypeArguments;

    const special_type = mapper.specializeValueType(type) as ObjectType;
    // before the array is specialized, mark the actual element type of the array
    if (special_type instanceof ArrayType) {
        special_type.setElement(typeArgs[0]);
    }
    if (special_type !== type) {
        if (!(type.meta.isInited && type.meta.originShape)) {
            AddSpecializeObjectType(type, () => {
                initBuiltinObjectTypeDescriptions(
                    mapper,
                    type,
                    special_type,
                    typeArgs,
                    need_update_type_args,
                );
            });
        } else {
            initBuiltinObjectTypeDescriptions(
                mapper,
                type,
                special_type,
                typeArgs,
                need_update_type_args,
            );
        }

        return special_type;
    }

    return type;
}

export function needSpecialized(type: ValueType) {
    if (type instanceof TypeParameterType && type.specialTypeArgument) {
        return true;
    }
    if (type instanceof ValueTypeWithArguments && type.specialTypeArguments) {
        return true;
    }
    return false;
}
