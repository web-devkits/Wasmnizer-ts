/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    ValueTypeKind,
    ValueType,
    ArrayType,
    MapType,
    SetType,
    Primitive,
    FunctionType,
    ObjectType,
    ObjectTypeFlag,
    TypeParameterType,
} from './value_types.js';
import { DefaultTypeId, PredefinedTypeId } from '../utils.js';
import { ObjectDescription, ObjectDescriptionType, Shape } from './runtime.js';

export function IsBuiltInObjectType(kind: ValueTypeKind): boolean {
    return (
        kind == ValueTypeKind.ARRAY ||
        kind == ValueTypeKind.SET ||
        kind == ValueTypeKind.MAP ||
        kind == ValueTypeKind.STRING || // string and raw string is object
        kind == ValueTypeKind.RAW_STRING ||
        kind == ValueTypeKind.OBJECT
    );
}

export function IsBuiltInType(kind: ValueTypeKind): boolean {
    return (
        (kind >= ValueTypeKind.PRIMITVE_BEGIN &&
            kind < ValueTypeKind.PRIMITVE_END) ||
        IsBuiltInObjectType(kind)
    );
}

export function IsBuiltInTypeButAny(kind: ValueTypeKind): boolean {
    return kind != ValueTypeKind.ANY && IsBuiltInType(kind);
}

interface ObjectInfo {
    type: ObjectDescriptionType;
    id: number;
    inst_name: string;
    class_name: string;
    has_generic?: boolean;
}

export interface SpecializeInfo {
    (): void;
}

const builtin_objects: { [key: string]: ObjectInfo } = {
    Array: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.ARRAY,
        inst_name: 'Array',
        class_name: 'ArrayConstructor',
        has_generic: true,
    },
    ArrayConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.ARRAY_CONSTRUCTOR,
        inst_name: 'Array',
        class_name: 'ArrayConstructor',
    },
    String: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.STRING_OBJECT,
        inst_name: 'String',
        class_name: 'StringConstructor',
    },
    StringConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.STRING_CONSTRUCTOR,
        inst_name: 'String',
        class_name: 'StringConstructor',
    },
    Promise: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.PROMISE,
        inst_name: 'Promise',
        class_name: 'PromiseConstructor',
        has_generic: true,
    },
    PromiseConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.PROMISE_CONSTRUCTOR,
        inst_name: 'Promise',
        class_name: 'PromiseConstructor',
    },
    Date: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.DATE,
        inst_name: 'Date',
        class_name: 'DateConstructor',
    },
    DateConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.DATE_CONSTRUCTOR,
        inst_name: 'Date',
        class_name: 'DateConstructor',
    },
    Map: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.MAP,
        inst_name: 'Map',
        class_name: 'MapConstructor',
        has_generic: true,
    },
    MapConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.MAP_CONSTRUCTOR,
        inst_name: 'Map',
        class_name: 'MapConstructor',
    },
    Set: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.SET,
        inst_name: 'Set',
        class_name: 'SetConstructor',
        has_generic: true,
    },
    SetConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.SET_CONSTRUCTOR,
        inst_name: 'Set',
        class_name: 'SetConstructor',
    },
    Error: {
        type: ObjectDescriptionType.OBJECT_INSTANCE,
        id: PredefinedTypeId.ERROR,
        inst_name: 'Error',
        class_name: 'ErrorConstructor',
        has_generic: false,
    },
    ErrorConstructor: {
        type: ObjectDescriptionType.OBJECT_CLASS,
        id: PredefinedTypeId.ERROR_CONSTRUCTOR,
        inst_name: 'Error',
        class_name: 'ErrorConstructor',
    },
};

export function IsBuiltinObject(name: string): boolean {
    return builtin_objects[name] != undefined;
}

const builtinTypes = new Map<string, ObjectType>();
const specializeList = new Map<ObjectType, SpecializeInfo[]>();

export function clearBuiltinTypes() {
    builtinTypes.clear();
}

export function clearSpecializeList() {
    specializeList.clear();
}

function getObjectAndConstructorInfos(name: string): [ObjectInfo, ObjectInfo] {
    const info = builtin_objects[name];
    if (info.type == ObjectDescriptionType.OBJECT_INSTANCE) {
        return [info, builtin_objects[info.class_name!]];
    }
    return [builtin_objects[info.inst_name!], info];
}

function ObjectDescriptionFlagToObjectTypeFlag(
    flags: ObjectDescriptionType,
): ObjectTypeFlag {
    if (flags == ObjectDescriptionType.OBJECT_INSTANCE)
        return ObjectTypeFlag.OBJECT;
    if (flags == ObjectDescriptionType.OBJECT_CLASS)
        return ObjectTypeFlag.CLASS;
    return ObjectTypeFlag.LITERAL;
}

function init_generic(info: ObjectInfo, type: ObjectType) {
    if (info.has_generic) {
        type.setTypeArguments([]);
    }
}

function createObjectTypes(
    inst_info: ObjectInfo,
    class_info: ObjectInfo,
    inst_meta: ObjectDescription,
    class_meta: ObjectDescription,
): [ObjectType, ObjectType] {
    let types: [ObjectType, ObjectType] | undefined = undefined;
    const inst_flags = ObjectDescriptionFlagToObjectTypeFlag(inst_info.type);
    const class_flags = ObjectDescriptionFlagToObjectTypeFlag(class_info.type);
    if (inst_info.id == PredefinedTypeId.ARRAY) {
        types = [
            new ArrayType(inst_info.id, inst_meta, inst_flags),
            new ArrayType(class_info.id, class_meta, class_flags),
        ];
    } else {
        types = [
            new ObjectType(inst_info.id, inst_meta, inst_flags),
            new ObjectType(class_info.id, class_meta, class_flags),
        ];
    }

    init_generic(inst_info, types[0]);
    init_generic(class_info, types[1]);

    return types!;
}

export function GetBuiltinObjectType(name: string): ObjectType {
    const type = builtinTypes.get(name);
    if (type) return type;

    // create the builtin Object
    //const names = getObjectAndConstructorName(name);
    //const name = names[0];
    //const ctr_name = names[1];
    const [inst_info, class_info] = getObjectAndConstructorInfos(name);

    const inst_meta = new ObjectDescription(
        inst_info.inst_name,
        ObjectDescriptionType.OBJECT_INSTANCE,
    );
    const class_meta = new ObjectDescription(
        inst_info.class_name,
        ObjectDescriptionType.OBJECT_CLASS,
    );

    class_meta.instance = inst_meta;
    inst_meta.clazz = class_meta;

    inst_meta.setBuiltin();
    class_meta.setBuiltin();

    const [inst_type, class_type] = createObjectTypes(
        inst_info,
        class_info,
        inst_meta,
        class_meta,
    );

    inst_type.classType = class_type;
    class_type.instanceType = inst_type;

    inst_type.setBuiltin();
    class_type.setBuiltin();
    builtinTypes.set(inst_info.inst_name, inst_type);
    builtinTypes.set(inst_info.class_name, class_type);

    return builtinTypes.get(name)!;
}

export function GetAndRemoveObjectSpecializeList(
    obj_type: ObjectType,
): SpecializeInfo[] | undefined {
    const list = specializeList.get(obj_type);
    specializeList.delete(obj_type);
    return list;
}

export function ProcessBuiltinObjectSpecializeList() {
    specializeList.forEach((list, obj) => {
        for (const cb of list) cb();
    });
    specializeList.clear();
}

export function AddSpecializeObjectType(
    obj_type: ObjectType,
    info: SpecializeInfo,
) {
    if (specializeList.has(obj_type)) {
        specializeList.get(obj_type)!.push(info);
    } else {
        specializeList.set(obj_type, [info]);
    }
}

export function ForEachBuiltinObject(cb: (obj_type: ObjectType) => void) {
    builtinTypes.forEach((obj_type, name) => cb(obj_type));
}

/////////////////////////////////////////////////////////////////
export function GetShapeFromType(
    type: ValueType,
    isThisShape = true,
): Shape | undefined {
    switch (type.kind) {
        case ValueTypeKind.OBJECT:
        case ValueTypeKind.ARRAY:
        case ValueTypeKind.MAP:
        case ValueTypeKind.SET:
            return isThisShape
                ? (type as ObjectType).meta.thisShape
                : (type as ObjectType).meta.originShape;
        case ValueTypeKind.FUNCTION: // TODO
            break;
        case ValueTypeKind.RAW_STRING: // TODO
        case ValueTypeKind.STRING: // TODO
            return GetBuiltinObjectType('String').meta.originShape;
    }
    return undefined;
}
