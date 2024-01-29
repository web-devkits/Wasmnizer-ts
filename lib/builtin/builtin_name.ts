/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { Type, TypeKind } from '../../src/type';

export namespace BuiltinNames {
    // wasm global variable
    export const dataEnd = '__data_end';
    export const stackPointer = '__stack_pointer';
    export const heapBase = '__heap_base';

    // wasm table
    export const extrefTable = 'extref_table';

    // wasm default variable
    export const byteSize = 32;
    export const stackSize = 1024;
    export const memInitialPages = 1;
    export const memMaximumPages = 10;
    export const tableInitialPages = 1;
    export const tableMaximumPages = 10;
    export const tableGrowDelta = 10;
    export const memoryReserveOffset = 0;
    export const memoryReserveMaxSize = 100;

    // wasm function
    export const start = '~start';
    export const globalInitFunc = 'global_init';

    // delimiters
    export const moduleDelimiter = '|';
    export const declareSuffix = '-declare';
    export const wrapperSuffix = '-wrapper';

    // import external name
    export const externalModuleName = 'env';

    // builtin module name
    export const builtinModuleName = 'builtin';

    // customize wasm util functions prefix name
    export const utilsFuncName = 'utils';

    // builtin libc functions
    export const mallocFunc = 'malloc';
    export const freeFunc = 'free';

    // builtin file name
    export const builtinTypeName = 'lib.type.d.ts';
    export const builtinImplementFileName = 'lib_builtin.ts';
    // export const builtinFileNames = ['lib.type.d.ts', builtinImplementFileName];
    // export const builtinFileNames = ['lib.type.d.ts'];
    export const builtinFileNames = [builtinTypeName, builtinImplementFileName];

    // builtin function name
    export const globalInitFuncName = 'global|init|func';
    export const findPropertyFlagAndIndex = 'find_property_flag_and_index';
    export const findPropertyType = 'find_property_type';
    export const getInfcProperty = 'get_infc_property';
    export const getTupleField = 'get_tuple_field';

    // builtin globals
    export const builtinTypeManglePrefix = 'lib/builtin/lib.type.d';
    export const nanName = `${builtinTypeManglePrefix}|NaN`;
    export const infinityName = `${builtinTypeManglePrefix}|Infinity`;
    export const builtinGlobalNames = [nanName, infinityName];

    // default envParamLen
    export const envParamLen = 2;

    // Globals that should be fallbacked to libdyntype
    export const jsonName = `${builtinTypeManglePrefix}|JSON`;
    export const promiseName = `${builtinTypeManglePrefix}|Promise`;
    export const dateName = `${builtinTypeManglePrefix}|Date`;
    export const fallbackGlobalNames = [jsonName, promiseName, dateName];

    // builtin class name
    export const MATH = 'Math';
    export const ARRAY = 'Array';
    export const STRING = 'String';
    export const NUMBER = 'Number';
    export const BOOLEAN = 'Boolean';
    export const OBJECT = 'Object';
    export const FUNCTION = 'Function';
    export const CONSOLE = 'console';
    export const PROMISE = 'Promise';
    export const MAP = 'Map';
    export const SET = 'Set';
    export const OBJECTCONSTRUCTOR = 'ObjectConstructor';
    export const FUNCTIONCONSTRCTOR = 'FunctionConstructor';
    export const ARRAYBUFFER = 'ArrayBuffer';
    export const ARRAYBUFFERCONSTRCTOR = 'ArrayBufferConstructor';
    export const DATAVIEW = 'DataView';
    export const STRINGCONSTRCTOR = 'StringConstructor';

    // decorator name
    export const decorator = 'binaryen';

    // decorator function name
    export const mathSqrtFuncName = 'Math|sqrt';
    export const mathAbsFuncName = 'Math|abs';
    export const mathCeilFuncName = 'Math|ceil';
    export const mathFloorFuncName = 'Math|floor';
    export const mathTruncFuncName = 'Math|trunc';
    export const arrayIsArrayFuncName = 'ArrayConstructor|isArray';
    export const stringConcatFuncName = 'String|concat';
    export const stringSliceFuncName = 'String|slice';
    export const stringEQFuncName = 'string_eq';
    export const stringReplaceFuncName = 'String|replace';
    export const stringSubStringFuncName = 'String|substring';
    export const stringCharCodeAtFuncName = 'String|charCodeAt';
    export const stringSplitFuncName = 'String|split';
    export const stringIndexOfFuncName = 'String|indexOf';
    export const stringLastIndexOfFuncName = 'String|lastIndexOf';
    export const stringIndexOfInternalFuncName = 'String|indexOfInternal';
    export const stringMatchFuncName = 'String|match';
    export const stringSearchFuncName = 'String|search';
    export const stringcharAtFuncName = 'String|charAt';
    export const stringtoLowerCaseFuncName = 'String|toLowerCase';
    export const stringtoUpperCaseFuncName = 'String|toUpperCase';
    export const stringtrimFuncName = 'String|trim';
    export const anyrefCond = 'anyrefCond';
    export const newExtRef = 'newExtRef';
    export const allocExtRefTableSlot = 'allocExtRefTableSlot';
    export const extRefTableMaskArr = 'extRefTableMaskArr';
    export const getPropertyIfTypeIdMismatch =
        'get_property_if_typeid_mismatch';
    export const setPropertyIfTypeIdMismatch =
        'set_property_if_typeid_mismatch';

    export const errorTag = 'error';
    export const finallyTag = 'finally';

    export interface GenericFuncName {
        generic: string;
        f64: string;
        i64: string;
        f32: string;
        i32: string;
        anyref: string;
    }

    const createGenericFuncNames = (
        class_name: string,
        method_name: string,
    ) => {
        return {
            generic: `${class_name}|${method_name}`,
            f64: `${class_name}|${method_name}_f64`,
            i64: `${class_name}|${method_name}_i64`,
            f32: `${class_name}|${method_name}_f32`,
            i32: `${class_name}|${method_name}_i32`,
            anyref: `${class_name}|${method_name}_anyref`,
        };
    };

    // builtin instance function name
    export const stringLengthFuncName = 'String|length';
    export const arrayLengthFuncName = 'Array|length';
    export const arrayPushFuncNames = createGenericFuncNames('Array', 'push');
    export const arrayPopFuncNames = createGenericFuncNames('Array', 'pop');
    export const arrayJoinFuncNames = createGenericFuncNames('Array', 'join');
    export const arrayConcatFuncNames = createGenericFuncNames(
        'Array',
        'concat',
    );
    export const arrayReverseFuncNames = createGenericFuncNames(
        'Array',
        'reverse',
    );
    export const arrayShiftFuncNames = createGenericFuncNames('Array', 'shift');
    export const arraySliceFuncNames = createGenericFuncNames('Array', 'slice');
    export const arraySortFuncNames = createGenericFuncNames('Array', 'sort');
    export const arraySpliceFuncNames = createGenericFuncNames(
        'Array',
        'splice',
    );
    export const arrayUnshiftFuncNames = createGenericFuncNames(
        'Array',
        'unshift',
    );
    export const arrayIndexOfFuncNames = createGenericFuncNames(
        'Array',
        'indexOf',
    );
    export const arrayLastIndexOfFuncNames = createGenericFuncNames(
        'Array',
        'lastIndexOf',
    );
    export const arrayEveryFuncNames = createGenericFuncNames('Array', 'every');
    export const arraySomeFuncNames = createGenericFuncNames('Array', 'some');
    export const arrayForEachFuncNames = createGenericFuncNames(
        'Array',
        'forEach',
    );
    export const arrayMapFuncNames = createGenericFuncNames('Array', 'map');
    export const arrayFilterFuncNames = createGenericFuncNames(
        'Array',
        'filter',
    );
    export const arrayReduceFuncNames = createGenericFuncNames(
        'Array',
        'reduce',
    );
    export const arrayReduceRightFuncNames = createGenericFuncNames(
        'Array',
        'reduceRight',
    );
    export const arrayFindFuncNames = createGenericFuncNames('Array', 'find');
    export const arrayFindIndexFuncNames = createGenericFuncNames(
        'Array',
        'findIndex',
    );
    export const arrayFillFuncNames = createGenericFuncNames('Array', 'fill');
    export const arrayCopyWithinFuncNames = createGenericFuncNames(
        'Array',
        'copyWithin',
    );
    export const arrayIncludesFuncNames = createGenericFuncNames(
        'Array',
        'includes',
    );

    // export let genericBuiltinMethods : string[] = [];

    export const genericBuiltinMethods = [
        `${builtinModuleName}|Array|push`,
        `${builtinModuleName}|Array|pop`,
        `${builtinModuleName}|Array|join`,
        `${builtinModuleName}|Array|concat`,
        `${builtinModuleName}|Array|reverse`,
        `${builtinModuleName}|Array|shift`,
        `${builtinModuleName}|Array|slice`,
        `${builtinModuleName}|Array|sort`,
        `${builtinModuleName}|Array|splice`,
        `${builtinModuleName}|Array|unshift`,
        `${builtinModuleName}|Array|indexOf`,
        `${builtinModuleName}|Array|lastIndexOf`,
        `${builtinModuleName}|Array|every`,
        `${builtinModuleName}|Array|some`,
        `${builtinModuleName}|Array|forEach`,
        `${builtinModuleName}|Array|map`,
        `${builtinModuleName}|Array|filter`,
        `${builtinModuleName}|Array|reduce`,
        `${builtinModuleName}|Array|reduceRight`,
        `${builtinModuleName}|Array|find`,
        `${builtinModuleName}|Array|findIndex`,
        `${builtinModuleName}|Array|fill`,
        `${builtinModuleName}|Array|copyWithin`,
        `${builtinModuleName}|Array|includes`,
    ];

    export const JSGlobalObjects: Set<string> = new Set();
    export const fallbackConstructors = [
        'Map',
        'Set',
        'Promise',
        'Date',
        'Error',
    ];
    export const builtInObjectTypes = [
        'ArrayBuffer',
        'DataView',
        'ArrayBufferConstructor',
        'Math',
        'Console',
        'Array',
        'ArrayConstructor',
        'StringConstructor',
    ];

    export function getSpecializedFuncName(
        mangledName: string,
        type: TypeKind,
    ): string {
        switch (type) {
            case TypeKind.NUMBER:
            case TypeKind.WASM_F64:
                return mangledName + '_f64';
            case TypeKind.WASM_F32:
                return mangledName + '_f32';
            case TypeKind.BOOLEAN:
            case TypeKind.WASM_I32:
                return mangledName + '_i32';
            case TypeKind.WASM_I64:
                return mangledName + '_i64';
            default:
                return mangledName + '_anyref';
        }
    }
    export const ObjectToStringMethod = 'toString';
    export const ObjectBuiltinMethods = [ObjectToStringMethod];
    export const getPropNamesByMeta = 'get_prop_name_by_meta';

    /* builtin constructor name */
    export const ctorName = 'Constructor';
}
