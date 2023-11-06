/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from './glue/binaryen.js';
import ts from 'typescript';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import { UnimplementError } from '../../error.js';
import { dyntype } from './lib/dyntype/utils.js';
import { SemanticsKind } from '../../semantics/semantics_nodes.js';
import {
    ObjectType,
    Primitive,
    PrimitiveType,
    TypeParameterType,
    UnionType,
    ValueType,
    ValueTypeKind,
} from '../../semantics/value_types.js';
import {
    StringRefMeatureOp,
    StringRefNewOp,
    arrayToPtr,
    baseVtableType,
    emptyStructType,
    stringArrayTypeForStringRef,
} from './glue/transform.js';
import {
    stringTypeInfo,
    charArrayTypeInfo,
    stringArrayTypeInfo,
    stringArrayStructTypeInfo,
    stringArrayStructTypeInfoForStringRef,
} from './glue/packType.js';
import {
    PredefinedTypeId,
    SourceLocation,
    getBuiltInFuncName,
} from '../../utils.js';
import {
    NewLiteralArrayValue,
    SemanticsValue,
    SemanticsValueKind,
} from '../../semantics/value.js';
import { ObjectDescriptionType } from '../../semantics/runtime.js';
import { getConfig } from '../../../config/config_mgr.js';
import { memoryAlignment } from './memory.js';

/** typeof an any type object */
export const enum DynType {
    DynUnknown,
    DynNull,
    DynUndefined,
    DynObject,
    DynBoolean,
    DynNumber,
    DynString,
    DynFunction,
    DynSymbol,
    DynBigInt,
    DynExtRefObj,
    DynExtRefFunc,
    DynExtRefInfc,
    DynExtRefArray,
}

export interface FlattenLoop {
    label: string;
    condition?: binaryen.ExpressionRef;
    statements: binaryen.ExpressionRef;
    incrementor?: binaryen.ExpressionRef;
}

export interface IfStatementInfo {
    condition: binaryen.ExpressionRef;
    ifTrue: binaryen.ExpressionRef;
    ifFalse: binaryen.ExpressionRef;
}

export interface BackendLocalVar {
    type: binaryen.Type;
    index: number;
}

export enum ItableFlag {
    FIELD = 0,
    METHOD,
    GETTER,
    SETTER,
    ALL,
}

export const enum StructFieldIndex {
    VTABLE_INDEX = 0,
}

export const enum VtableFieldIndex {
    META_INDEX = 0,
}

export const SIZE_OF_META_FIELD = 12;

export const enum MetaDataOffset {
    TYPE_ID_OFFSET = 0,
    IMPL_ID_OFFSET = 4,
    COUNT_OFFSET = 8,
    FIELDS_PTR_OFFSET = 12,
}

export const enum MetaPropertyOffset {
    NAME_OFFSET = 0,
    FLAG_AND_INDEX_OFFSET = 4,
    TYPE_OFFSET = 8,
}

export interface SourceMapLoc {
    location: SourceLocation;
    ref: binaryen.ExpressionRef;
}

export const META_FLAG_MASK = 0x0000000f;
export const META_INDEX_MASK = 0xfffffff0;

export namespace UtilFuncs {
    export function getFuncName(
        moduleName: string,
        funcName: string,
        delimiter = '|',
    ) {
        return moduleName.concat(delimiter).concat(funcName);
    }

    export function getLastElemOfBuiltinName(builtinName: string) {
        const levelNames = builtinName.split(BuiltinNames.moduleDelimiter);
        return levelNames[levelNames.length - 1];
    }

    export function addWatFuncs(
        watModule: binaryen.Module,
        funcName: string,
        curModule: binaryen.Module,
    ) {
        const funcRef = watModule.getFunction(funcName);
        const funcInfo = binaryen.getFunctionInfo(funcRef);
        curModule.addFunction(
            funcInfo.name,
            funcInfo.params,
            funcInfo.results,
            funcInfo.vars,
            curModule.copyExpression(funcInfo.body),
        );
    }

    export function isSupportedStringOP(opKind: ts.SyntaxKind) {
        switch (opKind) {
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.PlusToken:
            case ts.SyntaxKind.BarBarToken:
                return true;
            default:
                return false;
        }
    }

    export const wasmStringMap = new Map<string, number>();

    export function getCString(str: string) {
        if (wasmStringMap.has(str)) {
            return wasmStringMap.get(str) as number;
        }
        const wasmStr = binaryenCAPI._malloc(str.length + 1);
        let index = wasmStr;
        // consider UTF-8 only
        for (let i = 0; i < str.length; i++) {
            binaryenCAPI.__i32_store8(index++, str.codePointAt(i) as number);
        }
        binaryenCAPI.__i32_store8(index, 0);
        wasmStringMap.set(str, wasmStr);
        return wasmStr;
    }

    export function clearWasmStringMap() {
        wasmStringMap.clear();
    }

    export function utf16ToUtf8(utf16String: string): string {
        let utf8String = '';

        for (let i = 0; i < utf16String.length; i++) {
            const charCode = utf16String.charCodeAt(i);
            if (charCode <= 0x7f) {
                utf8String += String.fromCharCode(charCode);
            } else if (charCode <= 0x7ff) {
                utf8String += String.fromCharCode(
                    0xc0 | ((charCode >> 6) & 0x1f),
                );
                utf8String += String.fromCharCode(0x80 | (charCode & 0x3f));
            } else {
                utf8String += String.fromCharCode(
                    0xe0 | ((charCode >> 12) & 0x0f),
                );
                utf8String += String.fromCharCode(
                    0x80 | ((charCode >> 6) & 0x3f),
                );
                utf8String += String.fromCharCode(0x80 | (charCode & 0x3f));
            }
        }

        return utf8String;
    }
}

export namespace FunctionalFuncs {
    /* We need to get the dyntype context again and again, so we cache it
        here and don't call module.global.get every time */

    let dyntypeContextRef: binaryen.ExpressionRef | undefined;

    export function getEmptyRef(module: binaryen.Module) {
        return binaryenCAPI._BinaryenRefNull(
            module.ptr,
            emptyStructType.typeRef,
        );
    }

    export function resetDynContextRef() {
        dyntypeContextRef = undefined;
    }

    export function getDynContextRef(module: binaryen.Module) {
        if (!dyntypeContextRef) {
            /* module.global.get will cause memory leak issue,
                so we use C-API instead */
            dyntypeContextRef = binaryenCAPI._BinaryenGlobalGet(
                module.ptr,
                UtilFuncs.getCString(dyntype.dyntype_context),
                dyntype.dyn_ctx_t,
            );
        }

        return dyntypeContextRef;
    }

    export function flattenLoopStatement(
        module: binaryen.Module,
        loopStatementInfo: FlattenLoop,
        kind: SemanticsKind,
    ): binaryen.ExpressionRef {
        const condition = loopStatementInfo.condition || module.i32.const(1);
        const ifStatementInfo: IfStatementInfo = {
            condition: condition,
            ifTrue: binaryen.none,
            ifFalse: binaryen.none,
        };
        if (kind !== SemanticsKind.DOWHILE) {
            const ifTrueBlockArray: binaryen.ExpressionRef[] = [];
            if (loopStatementInfo.statements !== binaryen.none) {
                ifTrueBlockArray.push(loopStatementInfo.statements);
            }
            if (kind === SemanticsKind.FOR && loopStatementInfo.incrementor) {
                ifTrueBlockArray.push(
                    <binaryen.ExpressionRef>loopStatementInfo.incrementor,
                );
            }
            ifTrueBlockArray.push(module.br(loopStatementInfo.label));
            const ifTrueBlock = module.block(null, ifTrueBlockArray);
            ifStatementInfo.ifTrue = ifTrueBlock;
            return module.if(ifStatementInfo.condition, ifStatementInfo.ifTrue);
        } else {
            ifStatementInfo.ifTrue = module.br(loopStatementInfo.label);
            const blockArray: binaryen.ExpressionRef[] = [];
            if (loopStatementInfo.statements !== binaryen.none) {
                blockArray.push(loopStatementInfo.statements);
            }
            const ifExpression = module.if(
                ifStatementInfo.condition,
                ifStatementInfo.ifTrue,
            );
            blockArray.push(ifExpression);
            return module.block(null, blockArray);
        }
    }

    export function getVarDefaultValue(
        module: binaryen.Module,
        typeKind: ValueTypeKind,
        defaultValue?: binaryen.ExpressionRef,
    ): binaryen.ExpressionRef {
        switch (typeKind) {
            case ValueTypeKind.NUMBER:
                return defaultValue ? defaultValue : module.f64.const(0);
            case ValueTypeKind.BOOLEAN:
                return defaultValue ? defaultValue : module.i32.const(0);
            default:
                return getEmptyRef(module);
        }
    }

    /** for non-optional, return the type itself
     * for optional type(T|undefined) type, return the type without undefined
     */
    export function getStaticType(type: ValueType) {
        if (type instanceof UnionType) {
            if (type.types.size === 2 && type.types.has(Primitive.Undefined)) {
                for (const t of type.types) {
                    if (t !== Primitive.Undefined) {
                        return t;
                    }
                }
            }
        }
        return type;
    }

    export function isUnionWithUndefined(type: ValueType) {
        return (
            type instanceof UnionType &&
            type.types.size == 2 &&
            type.types.has(Primitive.Undefined)
        );
    }

    export function generateStringForStructArrayStr(
        module: binaryen.Module,
        value: string,
    ) {
        const valueLen = value.length;
        let strRelLen = valueLen;
        const charArray = [];
        for (let i = 0; i < valueLen; i++) {
            const codePoint = value.codePointAt(i)!;
            if (codePoint > 0xffff) {
                i++;
                strRelLen--;
            }
            charArray.push(module.i32.const(codePoint));
        }
        const valueContent = binaryenCAPI._BinaryenArrayNewFixed(
            module.ptr,
            charArrayTypeInfo.heapTypeRef,
            arrayToPtr(charArray).ptr,
            strRelLen,
        );
        const wasmStringValue = binaryenCAPI._BinaryenStructNew(
            module.ptr,
            arrayToPtr([module.i32.const(0), valueContent]).ptr,
            2,
            stringTypeInfo.heapTypeRef,
        );
        return wasmStringValue;
    }

    export function generateStringForStringref(
        module: binaryen.Module,
        ptr: binaryen.ExpressionRef,
        len: binaryen.ExpressionRef,
    ) {
        return binaryenCAPI._BinaryenStringNew(
            module.ptr,
            StringRefNewOp.UTF8,
            ptr,
            len,
            0,
            0,
            false,
        );
    }

    export function generateDynNumber(
        module: binaryen.Module,
        dynValue: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_new_number,
            [getDynContextRef(module), dynValue],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynBoolean(
        module: binaryen.Module,
        dynValue: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_new_boolean,
            [getDynContextRef(module), dynValue],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynString(
        module: binaryen.Module,
        dynValue: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_new_string,
            [getDynContextRef(module), dynValue],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynNull(module: binaryen.Module) {
        return module.call(
            dyntype.dyntype_new_null,
            [getDynContextRef(module)],
            dyntype.dyn_value_t,
        );
    }

    export function isDynUndefined(
        module: binaryen.Module,
        valueRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_is_undefined,
            [getDynContextRef(module), valueRef],
            binaryen.i32,
        );
    }

    export function generateDynUndefined(module: binaryen.Module) {
        return module.call(
            dyntype.dyntype_new_undefined,
            [getDynContextRef(module)],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynArray(
        module: binaryen.Module,
        arrLenRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_new_array,
            [getDynContextRef(module), arrLenRef],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynObj(module: binaryen.Module) {
        return module.call(
            dyntype.dyntype_new_object,
            [getDynContextRef(module)],
            dyntype.dyn_value_t,
        );
    }

    export function setDynArrElem(
        module: binaryen.Module,
        arrValueRef: binaryen.ExpressionRef,
        idxRef: binaryen.ExpressionRef,
        elemValueRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_set_elem,
            [getDynContextRef(module), arrValueRef, idxRef, elemValueRef],
            dyntype.cvoid,
        );
    }

    export function getDynArrElem(
        module: binaryen.Module,
        arrValueRef: binaryen.ExpressionRef,
        idxRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_get_elem,
            [getDynContextRef(module), arrValueRef, idxRef],
            dyntype.dyn_value_t,
        );
    }

    export function setDynObjProp(
        module: binaryen.Module,
        objValueRef: binaryen.ExpressionRef,
        propNameRef: binaryen.ExpressionRef,
        propValueRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_set_property,
            [getDynContextRef(module), objValueRef, propNameRef, propValueRef],
            dyntype.int,
        );
    }

    export function getDynObjProp(
        module: binaryen.Module,
        objValueRef: binaryen.ExpressionRef,
        propNameRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_get_property,
            [getDynContextRef(module), objValueRef, propNameRef],
            dyntype.dyn_value_t,
        );
    }

    export function getObjKeys(
        module: binaryen.Module,
        objValueRef: binaryen.ExpressionRef,
    ) {
        return module.call(
            dyntype.dyntype_get_keys,
            [getDynContextRef(module), objValueRef],
            dyntype.dyn_value_t,
        );
    }

    export function generateDynExtref(
        module: binaryen.Module,
        dynValue: binaryen.ExpressionRef,
        extrefTypeKind: ValueTypeKind,
    ) {
        // table type is anyref, no need to cast
        const dynFuncName: string = getBuiltInFuncName(BuiltinNames.newExtRef);
        let extObjKind: dyntype.ExtObjKind = 0;
        switch (extrefTypeKind) {
            case ValueTypeKind.OBJECT:
            case ValueTypeKind.INTERFACE: {
                extObjKind = dyntype.ExtObjKind.ExtObj;
                break;
            }
            case ValueTypeKind.FUNCTION: {
                extObjKind = dyntype.ExtObjKind.ExtFunc;
                break;
            }
            case ValueTypeKind.ARRAY: {
                extObjKind = dyntype.ExtObjKind.ExtArray;
                break;
            }
            default: {
                throw Error(
                    `unexpected type kind when boxing to external reference, type kind is ${extrefTypeKind}`,
                );
            }
        }
        /** workaround: Now Method's type in interface is always function type, but because of
         * optional, it can be anyref, so here also need to check if it is anyref
         */
        const type = binaryen.getExpressionType(dynValue);
        if (
            extrefTypeKind === ValueTypeKind.FUNCTION &&
            type === binaryen.anyref
        ) {
            return dynValue;
        }
        /** call newExtRef */
        const newExternRefCall = module.call(
            dynFuncName,
            [
                module.global.get(dyntype.dyntype_context, dyntype.dyn_ctx_t),
                module.i32.const(extObjKind),
                dynValue,
            ],
            binaryen.anyref,
        );
        return newExternRefCall;
    }

    export function generateCondition(
        module: binaryen.Module,
        exprRef: binaryen.ExpressionRef,
        srckind: ValueTypeKind,
    ) {
        const type = binaryen.getExpressionType(exprRef);
        let res: binaryen.ExpressionRef;

        if (binaryen.getExpressionType(exprRef) === binaryen.i32) {
            /* Sometimes the value has already been casted,
                no need to cast again */
            return exprRef;
        }

        if (srckind === ValueTypeKind.BOOLEAN) {
            res = exprRef;
        } else if (srckind === ValueTypeKind.NUMBER) {
            const n0 = module.f64.ne(exprRef, module.f64.const(0));
            const nNaN = module.f64.eq(exprRef, exprRef);
            res = module.i32.and(n0, nNaN);
        } else if (
            srckind === ValueTypeKind.ANY ||
            srckind === ValueTypeKind.UNDEFINED ||
            srckind === ValueTypeKind.UNION ||
            // for class/infc method, the ValueTypeKind cant represent the wasm type
            type === binaryen.anyref
        ) {
            const targetFunc = getBuiltInFuncName(BuiltinNames.anyrefCond);
            res = module.call(targetFunc, [exprRef], binaryen.i32);
        } else if (srckind === ValueTypeKind.STRING) {
            // '' => false, '123' => true
            let len: binaryen.ExpressionRef;
            if (getConfig().enableStringRef) {
                len = binaryenCAPI._BinaryenStringMeasure(
                    module.ptr,
                    StringRefMeatureOp.WTF16,
                    exprRef,
                );
            } else {
                const strArray = binaryenCAPI._BinaryenStructGet(
                    module.ptr,
                    1,
                    exprRef,
                    charArrayTypeInfo.typeRef,
                    false,
                );
                len = binaryenCAPI._BinaryenArrayLen(module.ptr, strArray);
            }
            res = module.i32.ne(len, module.i32.const(0));
        } else {
            res = module.i32.eqz(
                binaryenCAPI._BinaryenRefIsNull(module.ptr, exprRef),
            );
        }
        return res;
    }

    export function unboxAny(
        module: binaryen.Module,
        anyExprRef: binaryen.ExpressionRef,
        typeKind: ValueTypeKind,
        wasmType: binaryen.Type,
    ) {
        switch (typeKind) {
            case ValueTypeKind.NUMBER:
            case ValueTypeKind.BOOLEAN:
            case ValueTypeKind.STRING:
            case ValueTypeKind.NULL:
            case ValueTypeKind.ANY:
            case ValueTypeKind.UNION:
            case ValueTypeKind.UNDEFINED:
                return unboxAnyToBase(module, anyExprRef, typeKind);
            case ValueTypeKind.INTERFACE:
            case ValueTypeKind.ARRAY:
            case ValueTypeKind.OBJECT:
            case ValueTypeKind.FUNCTION: {
                return unboxAnyToExtref(module, anyExprRef, wasmType);
            }
            default:
                throw Error(`unboxAny: error kind  ${typeKind}`);
        }
    }

    export function unboxAnyToBase(
        module: binaryen.Module,
        anyExprRef: binaryen.ExpressionRef,
        typeKind: ValueTypeKind,
    ) {
        let cvtFuncName = '';
        let binaryenType: binaryen.Type;

        if (
            typeKind === ValueTypeKind.ANY ||
            typeKind === ValueTypeKind.UNION
        ) {
            return anyExprRef;
        }
        if (typeKind === ValueTypeKind.NULL) {
            return getEmptyRef(module);
        }
        if (typeKind === ValueTypeKind.UNDEFINED) {
            return generateDynUndefined(module);
        }

        /* native API's dynamic params */
        const dynParam = [getDynContextRef(module), anyExprRef];
        switch (typeKind) {
            case ValueTypeKind.NUMBER: {
                cvtFuncName = dyntype.dyntype_to_number;
                binaryenType = binaryen.f64;
                break;
            }
            case ValueTypeKind.BOOLEAN: {
                cvtFuncName = dyntype.dyntype_to_bool;
                binaryenType = binaryen.i32;
                /* Auto generate condition for boolean type */
                return generateCondition(module, anyExprRef, ValueTypeKind.ANY);
            }
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING: {
                const wasmStringType = getConfig().enableStringRef
                    ? binaryenCAPI._BinaryenTypeStringref()
                    : stringTypeInfo.typeRef;
                cvtFuncName = dyntype.dyntype_toString;
                binaryenType = wasmStringType;
                break;
            }
            default: {
                throw Error(
                    `unboxing any type to static type, unsupported static type : ${typeKind}`,
                );
            }
        }
        return module.call(cvtFuncName, dynParam, binaryenType);
    }

    export function isBaseType(
        module: binaryen.Module,
        anyExprRef: binaryen.ExpressionRef,
        condFuncName: string,
    ) {
        return module.call(
            condFuncName,
            [getDynContextRef(module), anyExprRef],
            dyntype.bool,
        );
    }

    export function convertTypeToI32(
        module: binaryen.Module,
        expression: binaryen.ExpressionRef,
        expressionType?: binaryen.Type,
    ): binaryen.ExpressionRef {
        const exprType = expressionType
            ? expressionType
            : binaryen.getExpressionType(expression);
        switch (exprType) {
            case binaryen.f64: {
                return module.i32.trunc_u_sat.f64(expression);
            }
            case binaryen.i32: {
                return expression;
            }
        }

        return binaryen.none;
    }

    export function convertTypeToI64(
        module: binaryen.Module,
        expression: binaryen.ExpressionRef,
        expressionType?: binaryen.Type,
    ): binaryen.ExpressionRef {
        const exprType = expressionType
            ? expressionType
            : binaryen.getExpressionType(expression);
        switch (expressionType) {
            case binaryen.f64: {
                return module.i64.trunc_u_sat.f64(expression);
            }
            case binaryen.i64: {
                return expression;
            }
        }
        return binaryen.none;
    }

    export function convertTypeToF64(
        module: binaryen.Module,
        expression: binaryen.ExpressionRef,
        expressionType?: binaryen.Type,
    ): binaryen.ExpressionRef {
        const exprType = expressionType
            ? expressionType
            : binaryen.getExpressionType(expression);
        switch (exprType) {
            case binaryen.i32: {
                return module.f64.convert_u.i32(expression);
            }
            case binaryen.i64: {
                return module.f64.convert_u.i64(expression);
            }
            case binaryen.f64: {
                return expression;
            }
        }
        return binaryen.none;
    }

    export function unboxAnyToExtref(
        module: binaryen.Module,
        anyExprRef: binaryen.ExpressionRef,
        wasmType: binaryen.Type,
    ) {
        let value: binaryen.ExpressionRef;
        if (wasmType === binaryen.anyref) {
            /* if wasm type is anyref type, then value may be a pure Quickjs value */
            value = anyExprRef;
        } else {
            /* unbox to externalRef */
            const tableIndex = module.call(
                dyntype.dyntype_to_extref,
                [getDynContextRef(module), anyExprRef],
                dyntype.int,
            );
            const externalRef = module.table.get(
                BuiltinNames.extrefTable,
                tableIndex,
                binaryen.anyref,
            );
            value = binaryenCAPI._BinaryenRefCast(
                module.ptr,
                externalRef,
                wasmType,
            );
        }
        return value;
    }

    export function boxToAny(
        module: binaryen.Module,
        valueRef: binaryen.ExpressionRef,
        value: SemanticsValue,
        arrLenRef?: binaryen.ExpressionRef,
    ) {
        let valueTypeKind = value.type.kind;
        /* value.type may be specialized, we should update the specialized type kind */
        if (value.type instanceof TypeParameterType) {
            const specializedType = (<TypeParameterType>value.type)
                .specialTypeArgument;
            if (specializedType) {
                valueTypeKind = specializedType.kind;
            } else {
                valueTypeKind = ValueTypeKind.ANY;
            }
        }
        const semanticsValueKind = value.kind;

        switch (valueTypeKind) {
            case ValueTypeKind.NUMBER:
            case ValueTypeKind.INT:
            case ValueTypeKind.BOOLEAN:
            case ValueTypeKind.STRING:
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.NULL:
            case ValueTypeKind.UNDEFINED:
            case ValueTypeKind.ANY:
            case ValueTypeKind.UNION:
                return boxBaseTypeToAny(module, valueRef, valueTypeKind);
            case ValueTypeKind.INTERFACE:
            case ValueTypeKind.ARRAY:
            case ValueTypeKind.OBJECT: {
                switch (semanticsValueKind) {
                    case SemanticsValueKind.NEW_LITERAL_ARRAY:
                    case SemanticsValueKind.NEW_LITERAL_OBJECT:
                        return boxLiteralToAny(module, value, arrLenRef);
                    default: {
                        return boxNonLiteralToAny(
                            module,
                            valueRef,
                            valueTypeKind,
                        );
                    }
                }
            }
            case ValueTypeKind.FUNCTION: {
                return boxNonLiteralToAny(module, valueRef, valueTypeKind);
            }
            default:
                throw Error(`boxToAny: error kind  ${valueTypeKind}`);
        }
    }

    export function boxBaseTypeToAny(
        module: binaryen.Module,
        valueRef: binaryen.ExpressionRef,
        valueTypeKind: ValueTypeKind,
    ): binaryen.ExpressionRef {
        switch (valueTypeKind) {
            case ValueTypeKind.NUMBER:
                return generateDynNumber(module, valueRef);
            case ValueTypeKind.INT: {
                const floatNumber = module.f64.convert_u.i32(valueRef);
                return generateDynNumber(module, floatNumber);
            }
            case ValueTypeKind.BOOLEAN:
                return generateDynBoolean(module, valueRef);
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING: {
                return generateDynString(module, valueRef);
            }
            case ValueTypeKind.NULL:
                return generateDynNull(module);
            case ValueTypeKind.UNDEFINED:
                return generateDynUndefined(module);
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY:
                return valueRef;
            default:
                throw Error(`boxBaseTypeToAny: error kind ${valueTypeKind}`);
        }
    }

    export function boxLiteralToAny(
        module: binaryen.Module,
        value: SemanticsValue,
        arrLenRef?: binaryen.ExpressionRef,
    ): binaryen.ExpressionRef {
        const valueTypeKind = value.type.kind;
        switch (valueTypeKind) {
            case ValueTypeKind.OBJECT:
                return generateDynObj(module);
            case ValueTypeKind.ARRAY:
                return generateDynArray(module, arrLenRef!);
            default:
                throw Error(`boxLiteralToAny: error kind ${valueTypeKind}`);
        }
    }

    export function boxNonLiteralToAny(
        module: binaryen.Module,
        valueRef: binaryen.ExpressionRef,
        valueTypeKind: ValueTypeKind,
    ): binaryen.ExpressionRef {
        switch (valueTypeKind) {
            case ValueTypeKind.NUMBER:
            case ValueTypeKind.BOOLEAN:
            case ValueTypeKind.STRING:
            case ValueTypeKind.NULL:
            case ValueTypeKind.UNDEFINED:
                return boxBaseTypeToAny(module, valueRef, valueTypeKind);
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY:
                return valueRef;

            case ValueTypeKind.INTERFACE:
            case ValueTypeKind.ARRAY:
            case ValueTypeKind.OBJECT:
            case ValueTypeKind.FUNCTION: {
                return generateDynExtref(module, valueRef, valueTypeKind);
            }
            default:
                throw Error(`boxNonLiteralToAny: error kind  ${valueTypeKind}`);
        }
    }

    export function operateF64F64(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        switch (opKind) {
            case ts.SyntaxKind.PlusToken: {
                return module.f64.add(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.MinusToken: {
                return module.f64.sub(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.AsteriskToken: {
                return module.f64.mul(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.SlashToken: {
                return module.f64.div(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.GreaterThanToken: {
                return module.f64.gt(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.GreaterThanEqualsToken: {
                return module.f64.ge(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.LessThanToken: {
                return module.f64.lt(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.LessThanEqualsToken: {
                return module.f64.le(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.LessThanLessThanToken: {
                return convertTypeToF64(
                    module,
                    module.i64.shl(
                        convertTypeToI64(module, leftValueRef, binaryen.f64),
                        convertTypeToI64(module, rightValueRef, binaryen.f64),
                    ),
                    binaryen.i64,
                );
            }
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken: {
                return module.f64.eq(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: {
                return module.f64.ne(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.AmpersandAmpersandToken: {
                return module.select(
                    convertTypeToI32(module, leftValueRef, binaryen.f64),
                    rightValueRef,
                    leftValueRef,
                    binaryen.f64,
                );
            }
            case ts.SyntaxKind.BarBarToken: {
                return module.select(
                    convertTypeToI32(module, leftValueRef, binaryen.f64),
                    leftValueRef,
                    rightValueRef,
                    binaryen.f64,
                );
            }
            case ts.SyntaxKind.AmpersandToken: {
                return convertTypeToF64(
                    module,
                    module.i64.and(
                        convertTypeToI64(module, leftValueRef, binaryen.f64),
                        convertTypeToI64(module, rightValueRef, binaryen.f64),
                    ),
                    binaryen.i64,
                );
            }
            case ts.SyntaxKind.BarToken: {
                return convertTypeToF64(
                    module,
                    module.i64.or(
                        convertTypeToI64(module, leftValueRef, binaryen.f64),
                        convertTypeToI64(module, rightValueRef, binaryen.f64),
                    ),
                    binaryen.i64,
                );
            }
            case ts.SyntaxKind.PercentToken: {
                const emptyRef = getEmptyRef(module);
                return module.call(
                    getBuiltInFuncName(BuiltinNames.percent),
                    [emptyRef, emptyRef, leftValueRef, rightValueRef],
                    binaryen.f64,
                );
            }
            default:
                throw new UnimplementError(`operateF64F64: ${opKind}`);
        }
    }

    export function operateStringString(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        let res: binaryen.ExpressionRef;

        switch (opKind) {
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken: {
                res = module.call(
                    UtilFuncs.getFuncName(
                        BuiltinNames.builtinModuleName,
                        BuiltinNames.stringEQFuncName,
                    ),
                    [leftValueRef, rightValueRef],
                    dyntype.bool,
                );

                if (
                    opKind === ts.SyntaxKind.ExclamationEqualsToken ||
                    opKind === ts.SyntaxKind.ExclamationEqualsEqualsToken
                ) {
                    res = module.i32.eqz(res);
                }

                break;
            }
            case ts.SyntaxKind.PlusToken: {
                const statementArray: binaryen.ExpressionRef[] = [];
                const arrayValue = binaryenCAPI._BinaryenArrayNewFixed(
                    module.ptr,
                    getConfig().enableStringRef
                        ? stringArrayTypeForStringRef.heapTypeRef
                        : stringArrayTypeInfo.heapTypeRef,
                    arrayToPtr([rightValueRef]).ptr,
                    1,
                );

                const arrayStruct = binaryenCAPI._BinaryenStructNew(
                    module.ptr,
                    arrayToPtr([arrayValue, module.i32.const(1)]).ptr,
                    2,
                    getConfig().enableStringRef
                        ? stringArrayStructTypeInfoForStringRef.heapTypeRef
                        : stringArrayStructTypeInfo.heapTypeRef,
                );

                statementArray.push(
                    module.call(
                        getBuiltInFuncName(BuiltinNames.stringConcatFuncName),
                        [getEmptyRef(module), leftValueRef, arrayStruct],
                        stringTypeInfo.typeRef,
                    ),
                );
                res = module.block(null, statementArray);
                break;
            }
            case ts.SyntaxKind.BarBarToken: {
                return module.select(
                    generateCondition(
                        module,
                        leftValueRef,
                        ValueTypeKind.STRING,
                    ),
                    leftValueRef,
                    rightValueRef,
                    stringTypeInfo.typeRef,
                );
            }
            default:
                throw new UnimplementError(
                    `operator doesn't support, ${opKind}`,
                );
        }

        return res;
    }

    export function operateRefRef(
        module: binaryen.Module,
        leftExprRef: binaryen.ExpressionRef,
        rightExprRef: binaryen.ExpressionRef,
        operatorKind: ts.SyntaxKind,
    ) {
        switch (operatorKind) {
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken: {
                return binaryenCAPI._BinaryenRefEq(
                    module.ptr,
                    leftExprRef,
                    rightExprRef,
                );
            }
            case ts.SyntaxKind.AmpersandAmpersandToken:
            case ts.SyntaxKind.BarBarToken: {
                const leftIsValidRef = module.i32.eqz(
                    binaryenCAPI._BinaryenRefIsNull(module.ptr, leftExprRef),
                );
                const rightIsValidRef = module.i32.eqz(
                    binaryenCAPI._BinaryenRefIsNull(module.ptr, rightExprRef),
                );
                if (operatorKind == ts.SyntaxKind.AmpersandAmpersandToken) {
                    return module.select(
                        leftIsValidRef,
                        rightIsValidRef,
                        leftIsValidRef,
                        binaryen.i32,
                    );
                } else {
                    return module.select(
                        leftIsValidRef,
                        leftIsValidRef,
                        rightIsValidRef,
                        binaryen.i32,
                    );
                }
            }
            default:
                throw new UnimplementError(
                    `operator doesn't support, ${operatorKind}`,
                );
        }
    }

    export function operateF64I32(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        switch (opKind) {
            case ts.SyntaxKind.AmpersandAmpersandToken: {
                return module.select(
                    convertTypeToI32(module, leftValueRef, binaryen.f64),
                    rightValueRef,
                    convertTypeToI32(module, leftValueRef, binaryen.f64),
                    binaryen.i32,
                );
            }
            case ts.SyntaxKind.BarBarToken: {
                return module.select(
                    convertTypeToI32(module, leftValueRef, binaryen.f64),
                    leftValueRef,
                    convertTypeToF64(module, rightValueRef, binaryen.i32),
                    binaryen.f64,
                );
            }
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken: {
                return module.f64.eq(
                    convertTypeToF64(module, leftValueRef),
                    convertTypeToF64(module, rightValueRef),
                );
            }
            default:
                throw new UnimplementError(
                    `operator doesn't support, ${opKind}`,
                );
        }
    }

    export function operateI32F64(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        switch (opKind) {
            case ts.SyntaxKind.AmpersandAmpersandToken: {
                const condition = Boolean(module.i32.eqz(leftValueRef));
                if (condition) {
                    return module.select(
                        leftValueRef,
                        convertTypeToI32(module, rightValueRef, binaryen.f64),
                        leftValueRef,
                        binaryen.i32,
                    );
                } else {
                    return rightValueRef;
                }
            }
            case ts.SyntaxKind.BarBarToken: {
                // if left is false, then condition is true
                const condition = Boolean(module.i32.eqz(leftValueRef));
                if (condition) {
                    return rightValueRef;
                } else {
                    return module.select(
                        leftValueRef,
                        convertTypeToF64(module, leftValueRef, binaryen.i32),
                        rightValueRef,
                        binaryen.f64,
                    );
                }
            }
            default:
                throw new UnimplementError(
                    `operator doesn't support, ${opKind}`,
                );
        }
    }

    export function operateI32I32(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        switch (opKind) {
            case ts.SyntaxKind.AmpersandAmpersandToken: {
                return module.select(
                    leftValueRef,
                    rightValueRef,
                    leftValueRef,
                    binaryen.i32,
                );
            }
            case ts.SyntaxKind.BarBarToken: {
                return module.select(
                    leftValueRef,
                    leftValueRef,
                    rightValueRef,
                    binaryen.i32,
                );
            }
            case ts.SyntaxKind.EqualsEqualsEqualsToken: {
                return module.i32.eq(leftValueRef, rightValueRef);
            }
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: {
                return module.i32.ne(leftValueRef, rightValueRef);
            }
            default:
                throw new UnimplementError(
                    `operator doesn't support, ${opKind}`,
                );
        }
    }

    export function treatAsAny(typeKind: ValueTypeKind) {
        if (
            typeKind === ValueTypeKind.ANY ||
            typeKind === ValueTypeKind.UNION
        ) {
            return true;
        }

        return false;
    }

    export function operateAnyAny(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        // TODO: not support ref type cmp
        let res: binaryen.ExpressionRef;
        switch (opKind) {
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.LessThanEqualsToken:
            case ts.SyntaxKind.LessThanToken:
            case ts.SyntaxKind.GreaterThanEqualsToken:
            case ts.SyntaxKind.GreaterThanToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: {
                res = module.call(
                    dyntype.dyntype_cmp,
                    [
                        getDynContextRef(module),
                        leftValueRef,
                        rightValueRef,
                        module.i32.const(opKind),
                    ],
                    binaryen.i32,
                );
                break;
            }
            default: {
                res = operateStaticToDyn(
                    module,
                    leftValueRef,
                    rightValueRef,
                    opKind,
                );
                break;
            }
        }
        return res;
    }

    export function operateStaticNullUndefined(
        module: binaryen.Module,
        leftValueType: ValueType,
        leftValueRef: binaryen.ExpressionRef,
        rightTypekind: ValueTypeKind,
        opKind: ts.SyntaxKind,
    ) {
        let res: binaryen.ExpressionRef;
        const isNotEqToken =
            opKind === ts.SyntaxKind.ExclamationEqualsToken ||
            opKind === ts.SyntaxKind.ExclamationEqualsEqualsToken
                ? true
                : false;
        if (leftValueType.kind === rightTypekind) {
            res = isNotEqToken ? 0 : 1;
        } else {
            res = isNotEqToken ? 1 : 0;
        }
        res = module.i32.const(res);
        // let xx: A | null === null;
        // xx === null
        if (
            !(leftValueType instanceof PrimitiveType) &&
            rightTypekind === ValueTypeKind.NULL
        ) {
            res = module.ref.is_null(leftValueRef);
            if (isNotEqToken) {
                res = module.i32.eqz(res);
            }
        }
        return res;
    }

    export function operatorAnyStatic(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        rightValueType: ValueType,
        opKind: ts.SyntaxKind,
    ) {
        let res: binaryen.ExpressionRef;
        const dynCtx = module.global.get(
            dyntype.dyntype_context,
            dyntype.dyn_ctx_t,
        );
        switch (opKind) {
            case ts.SyntaxKind.EqualsEqualsToken:
            case ts.SyntaxKind.EqualsEqualsEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsToken:
            case ts.SyntaxKind.ExclamationEqualsEqualsToken: {
                if (rightValueType.kind === ValueTypeKind.NULL) {
                    res = module.call(
                        dyntype.dyntype_is_null,
                        [dynCtx, leftValueRef],
                        binaryen.i32,
                    );
                    // TODO: ref.null need table.get support in native API
                } else if (rightValueType.kind === ValueTypeKind.UNDEFINED) {
                    res = isDynUndefined(module, leftValueRef);
                } else if (rightValueType.kind === ValueTypeKind.NUMBER) {
                    res = operateF64F64ToDyn(
                        module,
                        leftValueRef,
                        rightValueRef,
                        opKind,
                        true,
                    );
                } else if (rightValueType.kind === ValueTypeKind.STRING) {
                    res = operateStrStrToDyn(
                        module,
                        leftValueRef,
                        rightValueRef,
                        opKind,
                        true,
                    );
                } else {
                    throw new UnimplementError(
                        `operand type doesn't support on any static operation, static type is ${rightValueType}`,
                    );
                }
                if (
                    opKind === ts.SyntaxKind.ExclamationEqualsToken ||
                    opKind === ts.SyntaxKind.ExclamationEqualsEqualsToken
                ) {
                    res = module.i32.eqz(res);
                }
                break;
            }
            default:
                if (rightValueType.kind === ValueTypeKind.NUMBER) {
                    res = operateF64F64ToDyn(
                        module,
                        leftValueRef,
                        rightValueRef,
                        opKind,
                        true,
                    );
                } else if (rightValueType.kind === ValueTypeKind.STRING) {
                    res = operateStrStrToDyn(
                        module,
                        leftValueRef,
                        rightValueRef,
                        opKind,
                        true,
                    );
                } else {
                    throw new UnimplementError(
                        `operator doesn't support on any static operation, ${opKind}`,
                    );
                }
        }
        return res;
    }

    export function judgeRealType(
        module: binaryen.Module,
        valueRef: binaryen.ExpressionRef,
        realType: ValueTypeKind,
    ) {
        const dynTypeCtx = getDynContextRef(module);
        let res = module.unreachable();
        switch (realType) {
            case ValueTypeKind.STRING: {
                res = module.call(
                    dyntype.dyntype_is_string,
                    [dynTypeCtx, valueRef],
                    binaryen.i32,
                );
                break;
            }
            case ValueTypeKind.NUMBER: {
                res = module.call(
                    dyntype.dyntype_is_number,
                    [dynTypeCtx, valueRef],
                    binaryen.i32,
                );
                break;
            }
        }
        return res;
    }

    export function operateStaticToDyn(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
    ) {
        const needStringOp = module.select(
            judgeRealType(module, leftValueRef, ValueTypeKind.STRING),
            judgeRealType(module, leftValueRef, ValueTypeKind.STRING),
            judgeRealType(module, rightValueRef, ValueTypeKind.STRING),
        );
        const needNumberOp = module.select(
            judgeRealType(module, leftValueRef, ValueTypeKind.NUMBER),
            judgeRealType(module, rightValueRef, ValueTypeKind.NUMBER),
            judgeRealType(module, leftValueRef, ValueTypeKind.NUMBER),
        );

        const ifFalseRef = module.unreachable();
        return module.if(
            needStringOp,
            operateStrStrToDyn(module, leftValueRef, rightValueRef, opKind),
            module.if(
                needNumberOp,
                operateF64F64ToDyn(module, leftValueRef, rightValueRef, opKind),
                ifFalseRef,
            ),
        );
    }

    export function operateF64F64ToDyn(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
        isRightStatic = false,
    ) {
        const tmpLeftNumberRef = module.call(
            dyntype.dyntype_to_number,
            [getDynContextRef(module), leftValueRef],
            binaryen.f64,
        );
        const tmpRightNumberRef = isRightStatic
            ? rightValueRef
            : module.call(
                  dyntype.dyntype_to_number,
                  [getDynContextRef(module), rightValueRef],
                  binaryen.f64,
              );
        const operateNumber = operateF64F64(
            module,
            tmpLeftNumberRef,
            tmpRightNumberRef,
            opKind,
        );
        return generateDynNumber(module, operateNumber);
    }

    export function operateStrStrToDyn(
        module: binaryen.Module,
        leftValueRef: binaryen.ExpressionRef,
        rightValueRef: binaryen.ExpressionRef,
        opKind: ts.SyntaxKind,
        isRightStatic = false,
    ) {
        const tmpLeftStrRef = unboxAnyToBase(
            module,
            leftValueRef,
            ValueTypeKind.STRING,
        );
        const tmpRightStrRef = isRightStatic
            ? rightValueRef
            : unboxAnyToBase(module, rightValueRef, ValueTypeKind.STRING);
        let operateStringRef = module.unreachable();
        if (UtilFuncs.isSupportedStringOP(opKind)) {
            operateStringRef = generateDynString(
                module,
                operateStringString(
                    module,
                    tmpLeftStrRef,
                    tmpRightStrRef,
                    opKind,
                ),
            );
        }
        return operateStringRef;
    }

    export function oprateF64F64ToDyn(
        module: binaryen.Module,
        leftNumberExpression: binaryen.ExpressionRef,
        rightNumberExpression: binaryen.ExpressionRef,
        operatorKind: ts.SyntaxKind,
    ) {
        // operate left expression and right expression
        const operateTotalNumber = operateF64F64(
            module,
            leftNumberExpression,
            rightNumberExpression,
            operatorKind,
        );
        // generate dynamic number
        if (
            operatorKind === ts.SyntaxKind.GreaterThanToken ||
            operatorKind === ts.SyntaxKind.GreaterThanEqualsToken ||
            operatorKind === ts.SyntaxKind.LessThanToken ||
            operatorKind === ts.SyntaxKind.LessThanEqualsToken ||
            operatorKind === ts.SyntaxKind.EqualsEqualsToken ||
            operatorKind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            operatorKind === ts.SyntaxKind.ExclamationEqualsToken ||
            operatorKind === ts.SyntaxKind.ExclamationEqualsEqualsToken
        ) {
            return operateTotalNumber;
        }
        return generateDynNumber(module, operateTotalNumber);
    }

    export function getArrayRefLen(
        module: binaryen.Module,
        arrStructRef: binaryen.ExpressionRef,
        arrayValue?: SemanticsValue,
        propLenRef?: binaryen.ExpressionRef,
        returnI32?: boolean,
    ): binaryen.ExpressionRef {
        let arrLenI32Ref: binaryen.ExpressionRef | undefined;
        if (!arrayValue || arrayValue.type.kind == ValueTypeKind.ARRAY) {
            arrLenI32Ref = binaryenCAPI._BinaryenStructGet(
                module.ptr,
                1,
                arrStructRef,
                binaryen.getExpressionType(arrStructRef),
                false,
            );
        } else if (arrayValue.type.kind == ValueTypeKind.ANY && propLenRef) {
            const anyArrRef = arrStructRef;
            arrLenI32Ref = module.i32.trunc_u.f64(
                unboxAnyToBase(
                    module,
                    getDynObjProp(module, anyArrRef, propLenRef),
                    ValueTypeKind.NUMBER,
                ),
            );
        }
        if (returnI32) {
            return arrLenI32Ref!;
        } else {
            return convertTypeToF64(
                module,
                arrLenI32Ref!,
                binaryen.getExpressionType(arrLenI32Ref!),
            );
        }
    }

    export function getStringRefLen(
        module: binaryen.Module,
        stringRef: binaryen.ExpressionRef,
    ): binaryen.ExpressionRef {
        let strLenI32: binaryen.ExpressionRef;
        if (getConfig().enableStringRef) {
            strLenI32 = binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                stringRef,
            );
        } else {
            const strArray = binaryenCAPI._BinaryenStructGet(
                module.ptr,
                1,
                stringRef,
                charArrayTypeInfo.typeRef,
                false,
            );
            strLenI32 = binaryenCAPI._BinaryenArrayLen(module.ptr, strArray);
        }
        const strLenF64 = convertTypeToF64(
            module,
            strLenI32,
            binaryen.getExpressionType(strLenI32),
        );
        return strLenF64;
    }

    export function getArrayElemByIdx(
        module: binaryen.Module,
        elemTypeRef: binaryen.Type,
        ownerRef: binaryen.ExpressionRef,
        ownerHeapTypeRef: binaryenCAPI.HeapTypeRef,
        idxRef: binaryen.ExpressionRef,
    ) {
        const arrayOriRef = binaryenCAPI._BinaryenStructGet(
            module.ptr,
            0,
            ownerRef,
            ownerHeapTypeRef,
            false,
        );
        return binaryenCAPI._BinaryenArrayGet(
            module.ptr,
            arrayOriRef,
            idxRef,
            elemTypeRef,
            false,
        );
    }

    export function getFieldFromMetaByOffset(
        module: binaryen.Module,
        meta: binaryen.ExpressionRef,
        offset: number,
    ) {
        return module.i32.load(offset, memoryAlignment, meta);
    }

    export function getWasmStructFieldByIndex(
        module: binaryen.Module,
        ref: binaryen.ExpressionRef,
        typeRef: binaryen.Type,
        idx: number,
    ) {
        return binaryenCAPI._BinaryenStructGet(
            module.ptr,
            idx,
            ref,
            typeRef,
            false,
        );
    }

    export function getWASMObjectVtable(
        module: binaryen.Module,
        ref: binaryen.ExpressionRef,
    ) {
        return getWasmStructFieldByIndex(
            module,
            ref,
            baseVtableType.typeRef,
            StructFieldIndex.VTABLE_INDEX,
        );
    }

    export function getWASMObjectMeta(
        module: binaryen.Module,
        ref: binaryen.ExpressionRef,
    ) {
        const vtable = getWASMObjectVtable(module, ref);
        return getWasmStructFieldByIndex(
            module,
            vtable,
            binaryen.i32,
            VtableFieldIndex.META_INDEX,
        );
    }

    export function isPropertyExist(
        module: binaryen.Module,
        flagAndIndexRef: binaryen.ExpressionRef,
    ) {
        return module.i32.eq(flagAndIndexRef, module.i32.const(-1));
    }

    export function isFieldFlag(
        module: binaryen.Module,
        flagRef: binaryen.ExpressionRef,
    ) {
        return module.i32.eq(flagRef, module.i32.const(ItableFlag.FIELD));
    }

    export function isMethodFlag(
        module: binaryen.Module,
        flagRef: binaryen.ExpressionRef,
    ) {
        return module.i32.eq(flagRef, module.i32.const(ItableFlag.METHOD));
    }

    export function isShapeCompatible(
        module: binaryen.Module,
        typeId: number,
        metaRef: binaryen.ExpressionRef,
    ) {
        /* judge if type_id is equal or impl_id is equal */
        const infcTypeIdRef = module.i32.const(typeId);
        const objTypeIdRef = getFieldFromMetaByOffset(
            module,
            metaRef,
            MetaDataOffset.TYPE_ID_OFFSET,
        );
        const objImplIdRef = getFieldFromMetaByOffset(
            module,
            metaRef,
            MetaDataOffset.IMPL_ID_OFFSET,
        );
        const ifShapeCompatibal = module.i32.or(
            module.i32.eq(infcTypeIdRef, objTypeIdRef),
            module.i32.eq(infcTypeIdRef, objImplIdRef),
        );
        return ifShapeCompatibal;
    }

    export function getPredefinedTypeId(type: ValueType) {
        switch (type.kind) {
            case ValueTypeKind.UNDEFINED:
            case ValueTypeKind.UNION:
            case ValueTypeKind.TYPE_PARAMETER:
            case ValueTypeKind.ANY: {
                return PredefinedTypeId.ANY;
            }
            case ValueTypeKind.NULL:
                return PredefinedTypeId.NULL;
            case ValueTypeKind.INT:
                return PredefinedTypeId.INT;
            case ValueTypeKind.NUMBER:
                return PredefinedTypeId.NUMBER;
            case ValueTypeKind.BOOLEAN:
                return PredefinedTypeId.BOOLEAN;
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING:
                return PredefinedTypeId.STRING;
            case ValueTypeKind.FUNCTION:
                return PredefinedTypeId.FUNCTION;
            case ValueTypeKind.ARRAY:
                return PredefinedTypeId.ARRAY;
            case ValueTypeKind.INTERFACE:
            case ValueTypeKind.OBJECT: {
                const objType = type as ObjectType;
                return objType.typeId;
            }
            default:
                throw new UnimplementError(
                    `encounter type not assigned type id, type kind is ${type.kind}`,
                );
        }
    }
}
