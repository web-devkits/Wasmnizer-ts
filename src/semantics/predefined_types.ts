/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    ValueTypeKind,
    ValueType,
    Primitive,
    PrimitiveType,
    ArrayType,
    SetType,
    MapType,
    FunctionType,
} from './value_types.js';
import { PredefinedTypeId } from '../utils.js';
import { GetBuiltinObjectType } from './builtin.js';

import { specializeBuiltinObjectType } from './type_creator.js';
import { BuiltinNames } from '../../lib/builtin/builtin_name.js';

const predefinedTypes = new Map<PredefinedTypeId, ValueType>();

export function GetPredefinedType(typeId: number): ValueType | undefined {
    switch (typeId) {
        case PredefinedTypeId.VOID:
            return Primitive.Void;
        case PredefinedTypeId.UNDEFINED:
            return Primitive.Undefined;
        case PredefinedTypeId.NULL:
            return Primitive.Null;
        case PredefinedTypeId.NEVER:
            return Primitive.Never;
        case PredefinedTypeId.INT:
            return Primitive.Int;
        case PredefinedTypeId.NUMBER:
            return Primitive.Number;
        case PredefinedTypeId.BOOLEAN:
            return Primitive.Boolean;
        case PredefinedTypeId.RAW_STRING:
            return Primitive.RawString;
        case PredefinedTypeId.STRING:
            return Primitive.String;
        case PredefinedTypeId.ANY:
            return Primitive.Any;
    }

    let type = predefinedTypes.get(typeId);
    if (type) {
        return type;
    }

    type = createPredefinedType(typeId);
    if (type) {
        predefinedTypes.set(typeId, type);
    }
    return type;
}

function createPredefinedType(typeId: number): ValueType | undefined {
    switch (typeId) {
        case PredefinedTypeId.ARRAY:
            return GetBuiltinObjectType('Array');
        case PredefinedTypeId.ARRAY_CONSTRUCTOR:
            return GetBuiltinObjectType('ArrayConstructor');
        case PredefinedTypeId.ARRAY_ANY:
            return specializeBuiltinObjectType('Array', [Primitive.Any]);
        case PredefinedTypeId.ARRAY_INT:
            return specializeBuiltinObjectType('Array', [Primitive.Int]);
        case PredefinedTypeId.ARRAY_NUMBER:
            return specializeBuiltinObjectType('Array', [Primitive.Number]);
        case PredefinedTypeId.ARRAY_BOOLEAN:
            return specializeBuiltinObjectType('Array', [Primitive.Boolean]);
        case PredefinedTypeId.ARRAY_STRING:
            return specializeBuiltinObjectType('Array', [Primitive.String]);
        case PredefinedTypeId.SET_ANY:
            return specializeBuiltinObjectType('Set', [Primitive.Any]);
        case PredefinedTypeId.SET_INT:
            return specializeBuiltinObjectType('Set', [Primitive.Int]);
        case PredefinedTypeId.SET_NUMBER:
            return specializeBuiltinObjectType('Set', [Primitive.Number]);
        case PredefinedTypeId.SET_BOOLEAN:
            return specializeBuiltinObjectType('Set', [Primitive.Boolean]);
        case PredefinedTypeId.SET_STRING:
            return specializeBuiltinObjectType('Set', [Primitive.String]);
        case PredefinedTypeId.MAP_STRING_STRING:
            return specializeBuiltinObjectType('Map', [
                Primitive.String,
                Primitive.String,
            ]);
        case PredefinedTypeId.MAP_STRING_ANY:
            return specializeBuiltinObjectType('Map', [
                Primitive.String,
                Primitive.Any,
            ]);
        case PredefinedTypeId.MAP_INT_STRING:
            return specializeBuiltinObjectType('Map', [
                Primitive.Int,
                Primitive.String,
            ]);
        case PredefinedTypeId.MAP_INT_ANY:
            return specializeBuiltinObjectType('Map', [
                Primitive.Int,
                Primitive.Any,
            ]);
        case PredefinedTypeId.ERROR:
            return GetBuiltinObjectType('Error');
        case PredefinedTypeId.ERROR_CONSTRUCTOR:
            return GetBuiltinObjectType('ErrorConstructor');
        case PredefinedTypeId.FUNC_VOID_VOID_NONE:
            return new FunctionType(
                PredefinedTypeId.FUNC_VOID_VOID_NONE,
                Primitive.Void,
                [],
                undefined,
                undefined,
                0,
            );
        case PredefinedTypeId.FUNC_VOID_VOID_DEFAULT:
            return new FunctionType(
                PredefinedTypeId.FUNC_VOID_VOID_DEFAULT,
                Primitive.Void,
                [],
            );
        case PredefinedTypeId.FUNC_VOID_ARRAY_ANY_DEFAULT:
            return new FunctionType(
                PredefinedTypeId.FUNC_VOID_ARRAY_ANY_DEFAULT,
                Primitive.Void,
                [GetPredefinedType(PredefinedTypeId.ARRAY_ANY)!],
                undefined,
                0,
            );

        case PredefinedTypeId.FUNC_ANY_ARRAY_ANY_DEFAULT:
            return new FunctionType(
                PredefinedTypeId.FUNC_ANY_ARRAY_ANY_DEFAULT,
                Primitive.Any,
                [GetPredefinedType(PredefinedTypeId.ARRAY_ANY)!],
                undefined,
                0,
            );
        case PredefinedTypeId.FUNC_VOID_VOID_METHOD:
            return new FunctionType(
                PredefinedTypeId.FUNC_VOID_VOID_METHOD,
                Primitive.Void,
                [],
            );
        case PredefinedTypeId.FUNC_VOID_ARRAY_ANY_METHOD:
            return new FunctionType(
                PredefinedTypeId.FUNC_VOID_ARRAY_ANY_METHOD,
                Primitive.Void,
                [GetPredefinedType(PredefinedTypeId.ARRAY_ANY)!],
                undefined,
                0,
            );

        case PredefinedTypeId.FUNC_ANY_ARRAY_ANY_METHOD:
            return new FunctionType(
                PredefinedTypeId.FUNC_ANY_ARRAY_ANY_METHOD,
                Primitive.Any,
                [GetPredefinedType(PredefinedTypeId.ARRAY_ANY)!],
                undefined,
                0,
            );
    }
    return undefined;
}
