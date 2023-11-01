/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from '../glue/binaryen.js';
import { BuiltinNames } from '../../../../lib/builtin/builtin_name.js';
import {
    StringRefAsOp,
    StringRefEqOp,
    StringRefMeatureOp,
    StringRefSliceOp,
    StringRefNewOp,
    baseStructType,
    emptyStructType,
    stringArrayStructTypeForStringRef,
} from '../glue/transform.js';
import {
    UtilFuncs,
    FunctionalFuncs,
    FlattenLoop,
    MetaDataOffset,
    META_FLAG_MASK,
    ItableFlag,
    MetaPropertyOffset,
    SIZE_OF_META_FIELD,
} from '../utils.js';
import { dyntype } from './dyntype/utils.js';
import { arrayToPtr } from '../glue/transform.js';
import {
    charArrayTypeInfo,
    stringArrayTypeInfo,
    stringArrayStructTypeInfo,
    stringTypeInfo,
    stringArrayStructTypeInfoForStringRef,
    stringArrayTypeInfoForStringRef,
} from '../glue/packType.js';
import { array_get_data, array_get_length_i32 } from './array_utils.js';
import { SemanticsKind } from '../../../semantics/semantics_nodes.js';
import { ValueTypeKind } from '../../../semantics/value_types.js';
import { getBuiltInFuncName, getUtilsFuncName } from '../../../utils.js';
import { getConfig } from '../../../../config/config_mgr.js';
import { memoryAlignment } from '../memory.js';

function anyrefCond(module: binaryen.Module) {
    const ref = module.local.get(0, binaryen.anyref);

    const dynCtx = binaryenCAPI._BinaryenGlobalGet(
        module.ptr,
        UtilFuncs.getCString(dyntype.dyntype_context),
        dyntype.dyn_ctx_t,
    );
    const cond = module.call(
        dyntype.dyntype_is_extref,
        [dynCtx, ref],
        dyntype.bool,
    );
    const index = module.call(
        dyntype.dyntype_to_extref,
        [dynCtx, ref],
        dyntype.int,
    );
    const extRef = binaryenCAPI._BinaryenTableGet(
        module.ptr,
        UtilFuncs.getCString(BuiltinNames.extrefTable),
        index,
        binaryen.anyref,
    );

    const ifTrue = module.block(null, [
        module.return(
            module.i32.eqz(binaryenCAPI._BinaryenRefIsNull(module.ptr, extRef)),
        ),
    ]);
    const falsy = module.call(
        dyntype.dyntype_is_falsy,
        [dynCtx, ref],
        dyntype.bool,
    );
    const ifFalse = module.if(
        falsy,
        module.return(module.i32.const(0)),
        module.return(module.i32.const(1)),
    );
    const stmt = module.if(cond, ifTrue, ifFalse);
    return module.block(null, [stmt], binaryen.i32);
}

function getPropNameThroughMeta(module: binaryen.Module) {
    const objIndex = 0,
        elemsIndex = 1,
        metaIndex = 2,
        metaFieldsCountIndex = 3,
        metaFieldsPtrIndex = 4,
        propNameIndex = 5,
        fieldFlagIndex = 6,
        loopIndex = 7,
        iterPropCountIndex = 8,
        curCharIndex = 9,
        strLenIndex = 10;

    const obj = module.local.get(objIndex, baseStructType.typeRef);
    const elems = module.local.get(
        elemsIndex,
        stringArrayTypeInfoForStringRef.typeRef,
    );
    const meta = module.local.get(metaIndex, binaryen.i32);
    const mataFieldsCount = module.local.get(
        metaFieldsCountIndex,
        binaryen.i32,
    );
    const metaFieldsPtr = module.local.get(metaFieldsPtrIndex, binaryen.i32);
    const propName = module.local.get(propNameIndex, binaryen.i32);
    const fieldFlag = module.local.get(fieldFlagIndex, binaryen.i32);
    const loopIdx = module.local.get(loopIndex, binaryen.i32);
    const iterPropCount = module.local.get(iterPropCountIndex, binaryen.i32);
    const curChar = module.local.get(curCharIndex, binaryen.i32);
    const strLen = module.local.get(strLenIndex, binaryen.i32);

    const statementArray: binaryen.ExpressionRef[] = [];

    // 1. get meta
    const metaValue = FunctionalFuncs.getWASMObjectMeta(module, obj);
    statementArray.push(module.local.set(metaIndex, metaValue));

    // 2. get meta fields count
    statementArray.push(
        module.local.set(
            metaFieldsCountIndex,
            FunctionalFuncs.getFieldFromMetaByOffset(
                module,
                meta,
                MetaDataOffset.COUNT_OFFSET,
            ),
        ),
    );

    // 3. get meta fields ptr
    statementArray.push(
        module.local.set(
            metaFieldsPtrIndex,
            module.i32.add(
                meta,
                module.i32.const(MetaDataOffset.FIELDS_PTR_OFFSET),
            ),
        ),
    );

    statementArray.push(
        module.local.set(iterPropCountIndex, module.i32.const(0)),
    );

    // 4. get number of iterable properties, and fill string array by iterable names
    const loop = (loopLabel: string, ifTrueBlock: binaryen.ExpressionRef) => {
        const loopInit = module.local.set(loopIndex, module.i32.const(0));
        const loopCond = module.i32.lt_u(loopIdx, mataFieldsCount);
        const loopIncrementor = module.local.set(
            loopIndex,
            module.i32.add(loopIdx, module.i32.const(1)),
        );
        const loopStmtsArray: binaryen.ExpressionRef[] = [];
        const flagAndIndex = module.i32.load(
            MetaPropertyOffset.FLAG_AND_INDEX_OFFSET,
            memoryAlignment,
            metaFieldsPtr,
        );
        loopStmtsArray.push(
            module.local.set(
                fieldFlagIndex,
                module.i32.and(flagAndIndex, module.i32.const(META_FLAG_MASK)),
            ),
        );
        loopStmtsArray.push(
            module.if(
                module.i32.eq(fieldFlag, module.i32.const(ItableFlag.FIELD)),
                ifTrueBlock,
            ),
        );
        loopStmtsArray.push(
            module.local.set(
                metaFieldsPtrIndex,
                module.i32.add(
                    metaFieldsPtr,
                    module.i32.const(SIZE_OF_META_FIELD),
                ),
            ),
        );
        const forLoop: FlattenLoop = {
            label: loopLabel,
            condition: loopCond,
            statements: module.block(null, loopStmtsArray),
            incrementor: loopIncrementor,
        };
        statementArray.push(loopInit);
        statementArray.push(
            module.loop(
                loopLabel,
                FunctionalFuncs.flattenLoopStatement(
                    module,
                    forLoop,
                    SemanticsKind.FOR,
                ),
            ),
        );
    };

    // get number of iterable properties
    loop(
        'for_label1',
        module.local.set(
            iterPropCountIndex,
            module.i32.add(iterPropCount, module.i32.const(1)),
        ),
    );

    statementArray.push(
        module.local.set(
            elemsIndex,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                stringArrayTypeInfoForStringRef.heapTypeRef,
                iterPropCount,
                module.ref.null(binaryen.stringref),
            ),
        ),
    );

    // fill string array by iterable names
    statementArray.push(
        module.local.set(
            metaFieldsPtrIndex,
            module.i32.add(
                meta,
                module.i32.const(MetaDataOffset.FIELDS_PTR_OFFSET),
            ),
        ),
        module.local.set(iterPropCountIndex, module.i32.const(0)),
    );

    const getIterPropBlock = module.block(null, [
        module.local.set(
            propNameIndex,
            module.i32.load(
                MetaPropertyOffset.NAME_OFFSET,
                memoryAlignment,
                metaFieldsPtr,
            ),
        ),
        // get property name length by a loop
        module.local.set(
            curCharIndex,
            module.i32.add(propName, module.i32.const(-1)),
        ),
        module.loop(
            'label_0',
            module.block(null, [
                module.br_if(
                    'label_0',
                    module.i32.load8_u(
                        0,
                        0,
                        module.local.tee(
                            curCharIndex,
                            module.i32.add(curChar, module.i32.const(1)),
                            binaryen.i32,
                        ),
                    ),
                ),
            ]),
        ),
        module.local.set(strLenIndex, module.i32.sub(curChar, propName)),
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            elems,
            iterPropCount,
            binaryenCAPI._BinaryenStringNew(
                module.ptr,
                StringRefNewOp.UTF8,
                propName,
                strLen,
                0,
                0,
                false,
            ),
        ),
        module.local.set(
            iterPropCountIndex,
            module.i32.add(iterPropCount, module.i32.const(1)),
        ),
    ]);

    loop('for_label2', getIterPropBlock);

    // 5. create string array
    const stringArrayRef = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([elems, iterPropCount]).ptr,
        2,
        stringArrayStructTypeInfoForStringRef.heapTypeRef,
    );
    statementArray.push(module.return(stringArrayRef));

    return module.block(null, statementArray);
}

function string_concat(module: binaryen.Module) {
    /** Args: context, this, string[] */
    const thisStrStructIdx = 1;
    const paramStrArrayIdx = 2;
    /** Locals: totalLen, for_i(i32), newStrArrayIdx(char_array), copyCurLenIdx(i32) */
    const totalLenIdx = 3;
    const for_i_Idx = 4;
    const newStrArrayIdx = 5;
    const copyCurLenIdx = 6;
    /** structure index information */
    const arrayIdxInStruct = 1;
    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );
    const paramStrArray = module.local.get(
        paramStrArrayIdx,
        stringArrayStructTypeInfo.typeRef,
    );
    const thisStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const thisStrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray);
    const paramStrArrayLen = array_get_length_i32(module, paramStrArray);

    const getStringArrayFromRestParams = (module: binaryen.Module) => {
        return binaryenCAPI._BinaryenStructGet(
            module.ptr,
            arrayIdxInStruct,
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                array_get_data(module, paramStrArray),
                module.local.get(for_i_Idx, binaryen.i32),
                stringTypeInfo.typeRef,
                false,
            ),
            charArrayTypeInfo.typeRef,
            false,
        );
    };

    const statementArray: binaryen.ExpressionRef[] = [];
    /** 1. get total str length */
    statementArray.push(module.local.set(totalLenIdx, thisStrLen));
    const for_label_1 = 'for_loop_1_block';
    const for_init_1 = module.local.set(for_i_Idx, module.i32.const(0));
    const for_condition_1 = module.i32.lt_u(
        module.local.get(for_i_Idx, binaryen.i32),
        paramStrArrayLen,
    );
    const for_incrementor_1 = module.local.set(
        for_i_Idx,
        module.i32.add(
            module.local.get(for_i_Idx, binaryen.i32),
            module.i32.const(1),
        ),
    );
    const for_body_1 = module.local.set(
        totalLenIdx,
        module.i32.add(
            module.local.get(totalLenIdx, binaryen.i32),
            binaryenCAPI._BinaryenArrayLen(
                module.ptr,
                getStringArrayFromRestParams(module),
            ),
        ),
    );

    const flattenLoop_1: FlattenLoop = {
        label: for_label_1,
        condition: for_condition_1,
        statements: for_body_1,
        incrementor: for_incrementor_1,
    };
    statementArray.push(for_init_1);
    statementArray.push(
        module.loop(
            for_label_1,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop_1,
                SemanticsKind.FOR,
            ),
        ),
    );

    /** 2. generate new string */
    statementArray.push(
        module.local.set(
            newStrArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                charArrayTypeInfo.heapTypeRef,
                module.local.get(totalLenIdx, binaryen.i32),
                module.i32.const(0),
            ),
        ),
    );

    /** 3. traverse paramStrArray, do copy */
    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            thisStrArray,
            module.i32.const(0),
            thisStrLen,
        ),
    );
    statementArray.push(module.local.set(copyCurLenIdx, thisStrLen));

    const for_label_2 = 'for_loop_2_block';
    const for_init_2 = module.local.set(for_i_Idx, module.i32.const(0));
    const for_condition_2 = module.i32.lt_u(
        module.local.get(for_i_Idx, binaryen.i32),
        paramStrArrayLen,
    );
    const for_incrementor_2 = module.local.set(
        for_i_Idx,
        module.i32.add(
            module.local.get(for_i_Idx, binaryen.i32),
            module.i32.const(1),
        ),
    );
    const for_body_2 = module.block(null, [
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
            module.local.get(copyCurLenIdx, binaryen.i32),
            getStringArrayFromRestParams(module),
            module.i32.const(0),
            binaryenCAPI._BinaryenArrayLen(
                module.ptr,
                getStringArrayFromRestParams(module),
            ),
        ),
        module.local.set(
            copyCurLenIdx,
            module.i32.add(
                module.local.get(copyCurLenIdx, binaryen.i32),
                binaryenCAPI._BinaryenArrayLen(
                    module.ptr,
                    getStringArrayFromRestParams(module),
                ),
            ),
        ),
    ]);

    const flattenLoop_2: FlattenLoop = {
        label: for_label_2,
        condition: for_condition_2,
        statements: for_body_2,
        incrementor: for_incrementor_2,
    };
    statementArray.push(for_init_2);
    statementArray.push(
        module.loop(
            for_label_2,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop_2,
                SemanticsKind.FOR,
            ),
        ),
    );

    /** 4. generate new string structure */
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([
                    module.i32.const(0),
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                ]).ptr,
                2,
                stringTypeInfo.heapTypeRef,
            ),
        ),
    );

    /** 5. generate block, return block */
    const concatBlock = module.block('concat', statementArray);
    return concatBlock;
}

function string_concat_stringref(module: binaryen.Module) {
    const type = binaryenCAPI._BinaryenTypeStringref();
    const refIndex = 1;
    const strsIndex = 2;
    const strs = module.local.get(
        strsIndex,
        stringArrayStructTypeInfoForStringRef.typeRef,
    );
    const resIndex = 3;
    const res = module.local.get(resIndex, type);
    const strsLenIndex = 4;
    const strsLen = module.local.get(strsLenIndex, binaryen.i32);
    const loopIndexIndex = 5;
    const loopIndex = module.local.get(loopIndexIndex, binaryen.i32);
    const strArrayIndex = 6;
    const strArray = module.local.get(
        strArrayIndex,
        stringArrayTypeInfoForStringRef.typeRef,
    );
    const statementArray: binaryen.ExpressionRef[] = [];
    statementArray.push(
        module.local.set(resIndex, module.local.get(refIndex, type)),
    );
    const len = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        strs,
        binaryen.i32,
        false,
    );
    const strsContent = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        0,
        strs,
        stringArrayStructTypeForStringRef.typeRef,
        false,
    );
    statementArray.push(module.local.set(strsLenIndex, len));
    statementArray.push(module.local.set(loopIndexIndex, module.i32.const(0)));
    statementArray.push(module.local.set(strArrayIndex, strsContent));

    const loopLabel = 'for_label';
    const loopCond = module.i32.lt_s(loopIndex, strsLen);
    const loopIncrementor = module.local.set(
        loopIndexIndex,
        module.i32.add(loopIndex, module.i32.const(1)),
    );
    const loopBody: binaryen.ExpressionRef[] = [];
    const concat = module.local.set(
        resIndex,
        binaryenCAPI._BinaryenStringConcat(
            module.ptr,
            res,
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                strArray,
                loopIndex,
                type,
                false,
            ),
        ),
    );
    loopBody.push(concat);
    const flattenLoop: FlattenLoop = {
        label: loopLabel,
        condition: loopCond,
        statements: module.block(null, loopBody),
        incrementor: loopIncrementor,
    };

    statementArray.push(
        module.loop(
            loopLabel,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop,
                SemanticsKind.FOR,
            ),
        ),
    );

    statementArray.push(module.return(res));

    return module.block('concat', statementArray);
}

function string_eq(module: binaryen.Module) {
    const statementArray: binaryen.ExpressionRef[] = [];

    const leftstrIdx = 0;
    const rightstrIdx = 1;
    const for_i_Idx = 2;

    const leftstr = module.local.get(leftstrIdx, stringTypeInfo.typeRef);
    const rightstr = module.local.get(rightstrIdx, stringTypeInfo.typeRef);

    const leftstrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        leftstr,
        charArrayTypeInfo.typeRef,
        false,
    );
    const leftstrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, leftstrArray);
    const rightstrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        rightstr,
        charArrayTypeInfo.typeRef,
        false,
    );
    const rightstrLen = binaryenCAPI._BinaryenArrayLen(
        module.ptr,
        rightstrArray,
    );

    const retfalseLenNoEq = module.if(
        module.i32.ne(leftstrLen, rightstrLen),
        module.return(module.i32.const(0)),
    );

    statementArray.push(retfalseLenNoEq);

    const for_label_1 = 'for_loop_1_block';
    const for_init_1 = module.local.set(for_i_Idx, module.i32.const(0));
    const for_condition_1 = module.i32.lt_u(
        module.local.get(for_i_Idx, binaryen.i32),
        leftstrLen,
    );
    const for_incrementor_1 = module.local.set(
        for_i_Idx,
        module.i32.add(
            module.local.get(for_i_Idx, binaryen.i32),
            module.i32.const(1),
        ),
    );

    const for_body_1 = module.if(
        module.i32.ne(
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                leftstrArray,
                module.local.get(for_i_Idx, binaryen.i32),
                charArrayTypeInfo.typeRef,
                false,
            ),
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                rightstrArray,
                module.local.get(for_i_Idx, binaryen.i32),
                charArrayTypeInfo.typeRef,
                false,
            ),
        ),
        module.return(module.i32.const(0)),
    );

    const flattenLoop_1: FlattenLoop = {
        label: for_label_1,
        condition: for_condition_1,
        statements: for_body_1,
        incrementor: for_incrementor_1,
    };
    statementArray.push(for_init_1);
    statementArray.push(
        module.loop(
            for_label_1,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop_1,
                SemanticsKind.FOR,
            ),
        ),
    );

    statementArray.push(module.return(module.i32.const(1)));

    const stringeqBlock = module.block(null, statementArray);
    return stringeqBlock;
}

function string_eq_stringref(module: binaryen.Module) {
    const left_str_index = 0;
    const right_str_index = 1;
    const left_str = module.local.get(
        left_str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const right_str = module.local.get(
        right_str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );

    return binaryenCAPI._BinaryenStringEq(
        module.ptr,
        StringRefEqOp.EQ,
        left_str,
        right_str,
    );
}

function string_slice(module: binaryen.Module) {
    /** Args: context, this, start, end */
    const thisStrStructIdx = 1;
    const startParamIdx = 2;
    const endParamIdx = 3;
    /** Locals: start_i32, end_i32 */
    const startI32Idx = 4;
    const endI32Idx = 5;
    const newStrArrayIndex = 6;
    /** structure index information */
    const arrayIdxInStruct = 1;
    /** invoke binaryen API */
    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );
    const startAnyRef = module.local.get(startParamIdx, binaryen.anyref);
    const endAnyRef = module.local.get(endParamIdx, binaryen.anyref);
    const statementArray: binaryen.ExpressionRef[] = [];
    const strArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const strLen = binaryenCAPI._BinaryenArrayLen(module.ptr, strArray);

    /** 1. set start and end to i32 */
    const setAnyToI32 = (
        module: binaryen.Module,
        localIdx: number,
        anyRef: binaryen.ExpressionRef,
        defaultValue: binaryen.ExpressionRef,
    ) => {
        const isUndefined = FunctionalFuncs.isBaseType(
            module,
            anyRef,
            dyntype.dyntype_is_undefined,
        );
        const dynToNumberValue = FunctionalFuncs.unboxAnyToBase(
            module,
            anyRef,
            ValueTypeKind.NUMBER,
        );
        // get passed param value by string length
        const paramValue = module.if(
            module.f64.lt(dynToNumberValue, module.f64.const(0)),
            module.if(
                module.i32.le_s(
                    module.i32.add(
                        module.i32.trunc_s_sat.f64(dynToNumberValue),
                        strLen,
                    ),
                    module.i32.const(0),
                ),
                module.i32.const(0),
                module.i32.add(
                    module.i32.trunc_s_sat.f64(dynToNumberValue),
                    strLen,
                ),
            ),
            module.if(
                module.i32.le_s(
                    module.i32.trunc_s_sat.f64(dynToNumberValue),
                    strLen,
                ),
                module.i32.trunc_s_sat.f64(dynToNumberValue),
                strLen,
            ),
        );

        return module.if(
            module.i32.ne(isUndefined, module.i32.const(0)),
            module.local.set(localIdx, defaultValue),
            module.local.set(localIdx, paramValue),
        );
    };

    const setStartAnyToI32Ref = setAnyToI32(
        module,
        startI32Idx,
        startAnyRef,
        module.i32.const(0),
    );
    const setEndAnyToI32Ref = setAnyToI32(module, endI32Idx, endAnyRef, strLen);
    statementArray.push(setStartAnyToI32Ref);
    statementArray.push(setEndAnyToI32Ref);

    /** 2. get new string length */
    const start = module.local.get(startI32Idx, binaryen.i32);
    const end = module.local.get(endI32Idx, binaryen.i32);
    const newStrLen = module.if(
        module.i32.le_s(start, end),
        module.i32.sub(end, start),
        module.i32.const(0),
    );

    /** 3. copy value to new string */
    const newStrArrayType = charArrayTypeInfo.typeRef;
    const newStrArrayStatement = module.local.set(
        newStrArrayIndex,
        binaryenCAPI._BinaryenArrayNew(
            module.ptr,
            charArrayTypeInfo.heapTypeRef,
            newStrLen,
            module.i32.const(0),
        ),
    );
    statementArray.push(newStrArrayStatement);
    const arrayCopyStatement = module.if(
        module.i32.ne(newStrLen, module.i32.const(0)),
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newStrArrayIndex, newStrArrayType),
            module.i32.const(0),
            strArray,
            start,
            newStrLen,
        ),
    );
    statementArray.push(arrayCopyStatement);

    /** 4. generate new string structure */
    const newStrStruct = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([
            module.i32.const(0),
            module.local.get(newStrArrayIndex, newStrArrayType),
        ]).ptr,
        2,
        stringTypeInfo.heapTypeRef,
    );
    statementArray.push(module.return(newStrStruct));

    /** 5. generate block, return block */
    const sliceBlock = module.block('slice', statementArray);
    return sliceBlock;
}

function string_slice_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const start_index = 2;
    const end_index = 3;
    const start_i32_index = 4;
    const end_i32_index = 5;
    const value_index = 6;
    const value = module.local.get(value_index, binaryen.i32);
    const view_wtf16_index = 7;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const start = module.local.get(start_i32_index, binaryen.i32);
    const end = module.local.get(end_i32_index, binaryen.i32);
    const view_wtf16 = module.local.get(
        view_wtf16_index,
        binaryenCAPI._BinaryenTypeStringviewWTF16(),
    );
    const len = binaryenCAPI._BinaryenStringMeasure(
        module.ptr,
        StringRefMeatureOp.WTF16,
        ref,
    );

    const statementArray: binaryen.ExpressionRef[] = [];
    statementArray.push(
        module.local.set(
            view_wtf16_index,
            binaryenCAPI._BinaryenStringAs(
                module.ptr,
                StringRefAsOp.WTF16,
                ref,
            ),
        ),
    );

    const unboxSliceIndex = (
        index: number,
        defaultVar: binaryen.ExpressionRef,
    ) => {
        const anyRef = module.local.get(index, binaryen.anyref);
        const isUndefined = FunctionalFuncs.isBaseType(
            module,
            anyRef,
            dyntype.dyntype_is_undefined,
        );
        const num = module.i32.trunc_s_sat.f64(
            module.call(
                dyntype.dyntype_to_number,
                [FunctionalFuncs.getDynContextRef(module), anyRef],
                binaryen.f64,
            ),
        );
        return module.if(
            isUndefined,
            module.local.set(value_index, defaultVar),
            module.local.set(value_index, num),
        );
    };
    const getIndexOffset = (index: number) => {
        return module.if(
            module.i32.lt_s(value, module.i32.const(0)),
            module.local.set(index, module.i32.add(len, value)),
            module.local.set(index, value),
        );
    };
    statementArray.push(unboxSliceIndex(start_index, module.i32.const(0)));

    statementArray.push(getIndexOffset(start_i32_index));
    statementArray.push(unboxSliceIndex(end_index, len));
    statementArray.push(getIndexOffset(end_i32_index));
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                view_wtf16,
                start,
                end,
            ),
        ),
    );

    return module.block('slice', statementArray);
}

function string_replace(module: binaryen.Module) {
    /** Args: context, this, pattern, targetStr*/
    const thisStrStructIdx = 1;
    const patternStrIdx = 2;
    const targetStrIdx = 3;
    /** Locals: new char array, matched position, len of this str,
     *      len of pattern str, len of target str
     */
    const newCharArrayIdx = 4;
    const matchedPosIdx = 5;

    /* structure index informations*/
    const arrayIdxInStruct = 1;

    const statementArray: binaryen.ExpressionRef[] = [];
    /**1. get length of this str*/
    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );
    const thisStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );

    const thisStrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray);
    /**2. get pattern str and len*/
    const patternStrStruct = module.local.get(
        patternStrIdx,
        stringTypeInfo.typeRef,
    );
    const patternStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        patternStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const patternStrLen = binaryenCAPI._BinaryenArrayLen(
        module.ptr,
        patternStrArray,
    );

    /**3. Boundary condition */
    // 3.1 return if length doesn't meet requirements
    statementArray.push(
        module.if(
            module.i32.lt_s(thisStrLen, patternStrLen),
            module.return(thisStrStruct),
        ),
    );
    // 3.2 return if don't match
    statementArray.push(
        module.local.set(
            matchedPosIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(patternStrIdx, stringTypeInfo.typeRef),
                    module.i32.const(0),
                ],
                binaryen.i32,
            ),
        ),
    );
    statementArray.push(
        module.if(
            module.i32.eq(
                module.local.get(matchedPosIdx, binaryen.i32),
                module.i32.const(-1),
            ),
            module.return(thisStrStruct),
        ),
    );
    /**4. get target str and len */
    const targetStrStruct = module.local.get(
        targetStrIdx,
        stringTypeInfo.typeRef,
    );
    const targetStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        targetStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const targetStrLen = binaryenCAPI._BinaryenArrayLen(
        module.ptr,
        targetStrArray,
    );
    /**5. create a new string */
    const totalLen = module.i32.sub(
        module.i32.add(thisStrLen, targetStrLen),
        patternStrLen,
    );
    statementArray.push(
        module.local.set(
            newCharArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                charArrayTypeInfo.heapTypeRef,
                totalLen,
                module.i32.const(0),
            ),
        ),
    );

    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newCharArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            thisStrArray,
            module.i32.const(0),
            module.local.get(matchedPosIdx, binaryen.i32),
        ),
    );
    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newCharArrayIdx, charArrayTypeInfo.typeRef),
            module.local.get(matchedPosIdx, binaryen.i32),
            targetStrArray,
            module.i32.const(0),
            targetStrLen,
        ),
    );

    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newCharArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.add(
                module.local.get(matchedPosIdx, binaryen.i32),
                targetStrLen,
            ),
            thisStrArray,
            module.i32.add(
                module.local.get(matchedPosIdx, binaryen.i32),
                patternStrLen,
            ),
            module.i32.sub(
                thisStrLen,
                module.i32.add(
                    module.local.get(matchedPosIdx, binaryen.i32),
                    patternStrLen,
                ),
            ),
        ),
    );

    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([
                    module.i32.const(0),
                    module.local.get(
                        newCharArrayIdx,
                        charArrayTypeInfo.typeRef,
                    ),
                ]).ptr,
                2,
                stringTypeInfo.heapTypeRef,
            ),
        ),
    );

    const replaceBlock = module.block('replace', statementArray);
    return replaceBlock;
}

function string_replace_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const search_str_index = 2;
    const replace_str_index = 3;
    const target_pos_index = 4;
    const search_str_len_index = 5;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const search_str = module.local.get(
        search_str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const replace_str = module.local.get(
        replace_str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const target_pos = module.local.get(target_pos_index, binaryen.i32);
    const search_str_len = module.local.get(search_str_len_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    const pos = module.call(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.stringIndexOfInternalFuncName,
        ),
        [
            module.local.get(0, emptyStructType.typeRef),
            ref,
            search_str,
            module.i32.const(1),
            module.i32.const(0),
        ],
        binaryen.i32,
    );
    statementArray.push(module.local.set(target_pos_index, pos));
    statementArray.push(
        module.if(
            module.i32.eq(target_pos, module.i32.const(-1)),
            module.return(ref),
        ),
    );
    statementArray.push(
        module.local.set(
            search_str_len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                search_str,
            ),
        ),
    );
    let res = binaryenCAPI._BinaryenStringConcat(
        module.ptr,
        binaryenCAPI._BinaryenStringSliceWTF(
            module.ptr,
            StringRefSliceOp.WTF16,
            binaryenCAPI._BinaryenStringAs(
                module.ptr,
                StringRefAsOp.WTF16,
                ref,
            ),
            module.i32.const(0),
            target_pos,
        ),
        replace_str,
    );
    res = binaryenCAPI._BinaryenStringConcat(
        module.ptr,
        res,
        binaryenCAPI._BinaryenStringSliceWTF(
            module.ptr,
            StringRefSliceOp.WTF16,
            binaryenCAPI._BinaryenStringAs(
                module.ptr,
                StringRefAsOp.WTF16,
                ref,
            ),
            module.i32.add(target_pos, search_str_len),
            module.i32.const(-1),
        ),
    );

    statementArray.push(res);

    return module.block('replace', statementArray);
}

function string_split(module: binaryen.Module) {
    /** Args: context, this, string*/
    const thisStrStructIdx = 1;
    const sepStrIdx = 2;
    /** Locals: */
    // beging idx for each search
    const searchBegIdx = 3;
    // match idx for each search
    const matchIndexIdx = 4;
    // lenght of split result
    const resArrLenIdx = 5;
    // length of this str
    const thisStrLenIdx = 6;
    // length of sep str
    const sepStrLenIdx = 7;
    // split result
    const resStrArrayIdx = 8;
    // length of split part in each match
    const curStrLenIdx = 9;
    // temp char array for every split part
    const tempCharArrayIdx = 10;
    // cur index of the operating element in result array
    const curStrArrayIndexIdx = 11;

    const arrayIdxInStruct = 1;
    const statementArray: binaryen.ExpressionRef[] = [];

    /**0.1 get length of this string*/
    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );

    const thisStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const thisStrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray);
    statementArray.push(module.local.set(thisStrLenIdx, thisStrLen));

    /** 0.2 get length of sep string*/
    const sepStrStruct = module.local.get(sepStrIdx, stringTypeInfo.typeRef);

    const sepStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        sepStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const sepStrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, sepStrArray);
    statementArray.push(module.local.set(sepStrLenIdx, sepStrLen));

    /**1. cacl len of split array */
    const block_label_1 = 'block_label_1';
    const loop_label_1 = 'loop_block_1';
    const loop_init_1 = module.local.set(searchBegIdx, module.i32.const(0));
    const loop_stmts_1 = module.block(null, [
        module.local.set(
            matchIndexIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(sepStrIdx, stringTypeInfo.typeRef),
                    module.local.get(searchBegIdx, binaryen.i32),
                ],
                binaryen.i32,
            ),
        ),
        // inc length of res string array
        module.local.set(
            resArrLenIdx,
            module.i32.add(
                module.local.get(resArrLenIdx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
        // jmp out the loop
        module.br(
            block_label_1,
            module.i32.eq(
                module.local.get(matchIndexIdx, binaryen.i32),
                module.i32.const(-1),
            ),
        ),
        // update search begin
        module.local.set(
            searchBegIdx,
            module.i32.add(
                module.local.get(matchIndexIdx, binaryen.i32),
                module.local.get(sepStrLenIdx, binaryen.i32),
            ),
        ),
        // jmp to loop again
        module.br(loop_label_1),
    ]);
    const loop_1 = module.loop(loop_label_1, loop_stmts_1);
    const stmts_block_1 = module.block(block_label_1, [loop_init_1, loop_1]);
    statementArray.push(stmts_block_1);
    /**2. create an string array */
    statementArray.push(
        module.local.set(
            resStrArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                stringArrayTypeInfo.heapTypeRef,
                module.local.get(resArrLenIdx, binaryen.i32),
                module.ref.null(stringTypeInfo.typeRef),
            ),
        ),
    );

    /**3. copy split part to the result array */
    // helper function:
    const createNewCharArray = (module: binaryen.Module) => {
        return binaryenCAPI._BinaryenArrayNew(
            module.ptr,
            charArrayTypeInfo.heapTypeRef,
            module.local.get(curStrLenIdx, binaryen.i32),
            module.i32.const(0),
        );
    };

    const block_label_2 = 'block_label_2';
    const loop_label_2 = 'loop_block_2';
    // init search begin idx and current string idx in res array
    const loop_init_2 = module.block(null, [
        module.local.set(searchBegIdx, module.i32.const(0)),
        module.local.set(curStrArrayIndexIdx, module.i32.const(0)),
    ]);

    const loop_stmts_2 = module.block(null, [
        module.local.set(
            matchIndexIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(sepStrIdx, stringTypeInfo.typeRef),
                    module.local.get(searchBegIdx, binaryen.i32),
                ],
                binaryen.i32,
            ),
        ),
        // cal and set current sub string length
        module.if(
            module.i32.eq(
                module.local.get(matchIndexIdx, binaryen.i32),
                module.i32.const(-1),
            ),
            module.local.set(
                curStrLenIdx,
                module.i32.sub(
                    module.local.get(thisStrLenIdx, binaryen.i32),
                    module.local.get(searchBegIdx, binaryen.i32),
                ),
            ),
            module.local.set(
                curStrLenIdx,
                module.i32.sub(
                    module.local.get(matchIndexIdx, binaryen.i32),
                    module.local.get(searchBegIdx, binaryen.i32),
                ),
            ),
        ),
        // create a char array
        module.local.set(tempCharArrayIdx, createNewCharArray(module)),
        // fill the array
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(tempCharArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            thisStrArray,
            module.local.get(searchBegIdx, binaryen.i32),
            module.local.get(curStrLenIdx, binaryen.i32),
        ),
        // Creates a string and places it in the res array.
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            module.local.get(resStrArrayIdx, stringArrayTypeInfo.typeRef),
            module.local.get(curStrArrayIndexIdx, binaryen.i32),
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([
                    module.i32.const(0),
                    module.local.get(
                        tempCharArrayIdx,
                        charArrayTypeInfo.typeRef,
                    ),
                ]).ptr,
                2,
                stringTypeInfo.heapTypeRef,
            ),
        ),
        // inc the idx
        module.local.set(
            curStrArrayIndexIdx,
            module.i32.add(
                module.local.get(curStrArrayIndexIdx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
        // jmp out the loop
        module.br(
            block_label_2,
            module.i32.eq(
                module.local.get(matchIndexIdx, binaryen.i32),
                module.i32.const(-1),
            ),
        ),
        // jmp to loop
        module.local.set(
            searchBegIdx,
            module.i32.add(
                module.local.get(matchIndexIdx, binaryen.i32),
                module.local.get(sepStrLenIdx, binaryen.i32),
            ),
        ),
        module.br(loop_label_2),
    ]);
    const loop_2 = module.loop(loop_label_2, loop_stmts_2);
    const stmts_block_2 = module.block(block_label_2, [loop_init_2, loop_2]);
    statementArray.push(stmts_block_2);

    /**4. wrap the array with struct */
    const arrayStructRef = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([
            module.local.get(resStrArrayIdx, stringArrayTypeInfo.typeRef),
            module.local.get(resArrLenIdx, binaryen.i32),
        ]).ptr,
        2,
        stringArrayStructTypeInfo.heapTypeRef,
    );
    statementArray.push(module.return(arrayStructRef));

    const sliceBlock = module.block('split', statementArray);
    return sliceBlock;
}

function string_split_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const sep_index = 2;
    const elems_index = 3;
    const searchBegIdx = 4;
    const matchIndexIdx = 5;
    const elems_len_index = 6;
    const sep_len_index = 7;
    const remain_str_index = 8;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const sep = module.local.get(
        sep_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const elems = module.local.get(
        elems_index,
        stringArrayTypeInfoForStringRef.typeRef,
    );
    const searchBeg = module.local.get(searchBegIdx, binaryen.i32);
    const elems_len = module.local.get(elems_len_index, binaryen.i32);
    const sep_len = module.local.get(sep_len_index, binaryen.i32);
    const matchIndex = module.local.get(matchIndexIdx, binaryen.i32);
    const remain_str = module.local.get(
        remain_str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(module.local.set(elems_len_index, module.i32.const(0)));
    statementArray.push(
        module.local.set(
            sep_len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                sep,
            ),
        ),
    );

    // 1. get array length
    const block_label_1 = 'block_label_1';
    const loop_label_1 = 'loop_block_1';
    const loop_init_1 = module.local.set(searchBegIdx, module.i32.const(0));
    const loop_stmts_1 = module.block(null, [
        module.local.set(
            matchIndexIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    ref,
                    sep,
                    module.i32.const(1),
                    searchBeg,
                ],
                binaryen.i32,
            ),
        ),
        module.local.set(
            elems_len_index,
            module.i32.add(elems_len, module.i32.const(1)),
        ),
        module.br(
            block_label_1,
            module.i32.eq(matchIndex, module.i32.const(-1)),
        ),
        module.local.set(searchBegIdx, module.i32.add(matchIndex, sep_len)),
        module.br(loop_label_1),
    ]);
    const loop_1 = module.loop(loop_label_1, loop_stmts_1);
    const stmts_block_1 = module.block(block_label_1, [loop_init_1, loop_1]);
    statementArray.push(stmts_block_1);

    // 2. create array
    statementArray.push(
        module.local.set(
            elems_index,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                stringArrayTypeInfoForStringRef.heapTypeRef,
                elems_len,
                module.ref.null(binaryenCAPI._BinaryenTypeStringref()),
            ),
        ),
    );

    // 3.split string by sep
    statementArray.push(module.local.set(remain_str_index, ref));
    statementArray.push(module.local.set(elems_len_index, module.i32.const(0)));

    const block_label_2 = 'block_label_2';
    const loop_label_2 = 'loop_block_2';
    const loop_stmts_2 = module.block(null, [
        module.local.set(
            matchIndexIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    remain_str,
                    sep,
                    module.i32.const(1),
                    module.i32.const(0),
                ],
                binaryen.i32,
            ),
        ),
        module.br(
            block_label_2,
            module.i32.eq(matchIndex, module.i32.const(-1)),
        ),
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            elems,
            elems_len,
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    remain_str,
                ),
                module.i32.const(0),
                matchIndex,
            ),
        ),
        module.local.set(
            remain_str_index,
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    remain_str,
                ),
                module.i32.add(matchIndex, sep_len),
                module.i32.const(-1),
            ),
        ),
        module.local.set(
            elems_len_index,
            module.i32.add(elems_len, module.i32.const(1)),
        ),
        module.br(loop_label_2),
    ]);

    const loop_2 = module.loop(loop_label_2, loop_stmts_2);
    const stmts_block_2 = module.block(block_label_2, [loop_2]);
    statementArray.push(stmts_block_2);
    statementArray.push(
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            elems,
            elems_len,
            remain_str,
        ),
    );
    // 4. return array
    const structArrayRef = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([elems, module.i32.add(elems_len, module.i32.const(1))]).ptr,
        2,
        stringArrayStructTypeInfoForStringRef.heapTypeRef,
    );
    statementArray.push(module.return(structArrayRef));

    return module.block('split', statementArray);
}

function string_indexOf_internal(module: binaryen.Module) {
    /** Args: context, thisStr, pattern, begin Index*/
    const thisStrStructIdx = 1;
    const patternStrIdx = 2;
    const beginIdx = 3;
    /* Locals: i, iend, j, len of this str, len of pattern str*/
    const loopVarIIdx = 4;
    const loopVarIEndIdx = 5;
    const loopVarJIdx = 6;
    const thisStrLenIdx = 7;
    const patternLenIdx = 8;
    /* structure index informations*/
    const arrayIdxInStruct = 1;

    const statementsArray: binaryen.ExpressionRef[] = [];
    /**0. get len of thisStr and patternStr*/
    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );

    const patternStrSturct = module.local.get(
        patternStrIdx,
        stringTypeInfo.typeRef,
    );

    const thisStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );

    const patternStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        patternStrSturct,
        charArrayTypeInfo.typeRef,
        false,
    );

    statementsArray.push(
        module.local.set(
            thisStrLenIdx,
            binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray),
        ),
        module.local.set(
            patternLenIdx,
            binaryenCAPI._BinaryenArrayLen(module.ptr, patternStrArray),
        ),
    );

    /** 1. get iend and set patternStrLen*/
    statementsArray.push(
        module.local.set(
            loopVarIEndIdx,
            module.i32.sub(
                module.local.get(thisStrLenIdx, binaryen.i32),
                module.local.get(patternLenIdx, binaryen.i32),
            ),
        ),
    );
    /** 2. Loop1 head line*/
    const forLabel1 = 'for_loop_block1';
    const forInit1 = module.local.set(
        loopVarIIdx,
        module.local.get(beginIdx, binaryen.i32),
    );
    const forCondition1 = module.i32.le_s(
        module.local.get(loopVarIIdx, binaryen.i32),
        module.local.get(loopVarIEndIdx, binaryen.i32),
    );
    const forIncrementor1 = module.local.set(
        loopVarIIdx,
        module.i32.add(
            module.local.get(loopVarIIdx, binaryen.i32),
            module.i32.const(1),
        ),
    );

    /* 3. Loop2 headline*/
    const forLabel2 = 'for_loop_2_block';
    const forInit2 = module.local.set(loopVarJIdx, module.i32.const(0));
    const forCondition2 = module.i32.lt_s(
        module.local.get(loopVarJIdx, binaryen.i32),
        module.local.get(patternLenIdx, binaryen.i32),
    );
    const forIncrementor2 = module.local.set(
        loopVarJIdx,
        module.i32.add(
            module.local.get(loopVarJIdx, binaryen.i32),
            module.i32.const(1),
        ),
    );
    const forLoop1Block1 = 'for_loop_1_Block_1';
    /* 3.1 Loop2 body*/
    const forBody2 = module.br(
        forLoop1Block1,
        module.i32.ne(
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                patternStrArray,
                module.local.get(loopVarJIdx, binaryen.i32),
                charArrayTypeInfo.typeRef,
                false,
            ),
            binaryenCAPI._BinaryenArrayGet(
                module.ptr,
                thisStrArray,
                module.i32.add(
                    module.local.get(loopVarJIdx, binaryen.i32),
                    module.local.get(loopVarIIdx, binaryen.i32),
                ),
                charArrayTypeInfo.typeRef,
                false,
            ),
        ),
    );

    const flattenLoop_2: FlattenLoop = {
        label: forLabel2,
        condition: forCondition2,
        statements: forBody2,
        incrementor: forIncrementor2,
    };

    /**4 Loop1 body */
    const forBody1Statements: binaryen.ExpressionRef[] = [];

    forBody1Statements.push(forInit2);
    forBody1Statements.push(
        module.block(forLoop1Block1, [
            module.loop(
                forLabel2,
                FunctionalFuncs.flattenLoopStatement(
                    module,
                    flattenLoop_2,
                    SemanticsKind.FOR,
                ),
            ),
        ]),
    );

    forBody1Statements.push(
        module.if(
            module.i32.eq(
                module.local.get(loopVarJIdx, binaryen.i32),
                module.local.get(patternLenIdx, binaryen.i32),
            ),
            module.return(module.local.get(loopVarIIdx, binaryen.i32)),
        ),
    );

    const flattenLoop_1: FlattenLoop = {
        label: forLabel1,
        condition: forCondition1,
        statements: module.block(null, forBody1Statements),
        incrementor: forIncrementor1,
    };
    statementsArray.push(
        forInit1,
        module.loop(
            forLabel1,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop_1,
                SemanticsKind.FOR,
            ),
        ),
    );

    /**5. default return -1*/
    statementsArray.push(module.i32.const(-1));

    const Block = module.block('indexOfInternal', statementsArray);
    return Block;
}

function string_indexOf(module: binaryen.Module) {
    /** Args: context, this, pattern*/
    const thisStrStructIdx = 1;
    const paramStrIdx = 2;

    const statementArray: binaryen.ExpressionRef[] = [];
    /** call IndexofInternal and convert answer to f64 */
    statementArray.push(
        module.f64.convert_s.i32(
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(paramStrIdx, stringTypeInfo.typeRef),
                    module.i32.const(0),
                ],
                binaryen.i32,
            ),
        ),
    );
    const Block = module.block('indexOf', statementArray);
    return Block;
}

function string_indexOf_internal_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const str_index = 2;
    const start_from_front_index = 3;
    const loop_start_index = 4;
    const ref_len_index = 5;
    const str_len_index = 6;
    const loop_index = 7;
    const cur_index = 8;
    const end_index = 9;
    const res_index = 10;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const str = module.local.get(
        str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const start_from_front = module.local.get(
        start_from_front_index,
        binaryen.i32,
    );
    const ref_len = module.local.get(ref_len_index, binaryen.i32);
    const str_len = module.local.get(str_len_index, binaryen.i32);
    const loop_value = module.local.get(loop_index, binaryen.i32);
    const cur = module.local.get(
        cur_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const end = module.local.get(end_index, binaryen.i32);
    const res = module.local.get(res_index, binaryen.i32);
    const loop_start = module.local.get(loop_start_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(module.local.set(res_index, module.i32.const(-1)));
    statementArray.push(module.local.set(loop_index, loop_start));
    statementArray.push(
        module.local.set(
            ref_len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                ref,
            ),
        ),
    );
    statementArray.push(
        module.local.set(
            str_len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                str,
            ),
        ),
    );
    statementArray.push(
        module.local.set(
            end_index,
            module.i32.add(
                module.i32.sub(ref_len, str_len),
                module.i32.const(1),
            ),
        ),
    );
    const loopLabel = 'for_loop';
    const loopCond = module.i32.lt_s(loop_value, end);
    const loopIncrementor = module.local.set(
        loop_index,
        module.i32.add(loop_value, module.i32.const(1)),
    );
    const loopBody: binaryen.ExpressionRef[] = [];
    loopBody.push(
        module.local.set(
            cur_index,
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    ref,
                ),
                loop_value,
                module.i32.add(loop_value, str_len),
            ),
        ),
    );
    const cond = binaryenCAPI._BinaryenStringEq(
        module.ptr,
        StringRefEqOp.EQ,
        cur,
        str,
    );
    loopBody.push(
        module.if(
            cond,
            module.block(null, [
                module.local.set(res_index, loop_value),
                module.if(start_from_front, module.return(res)),
            ]),
        ),
    );
    const flattenLoop: FlattenLoop = {
        label: loopLabel,
        condition: loopCond,
        statements: module.block(null, loopBody),
        incrementor: loopIncrementor,
    };

    statementArray.push(
        module.loop(
            loopLabel,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop,
                SemanticsKind.FOR,
            ),
        ),
    );
    statementArray.push(module.return(res));

    return module.block('indexOf', statementArray);
}

function string_indexOf_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const str_index = 2;
    const statementArray: binaryen.ExpressionRef[] = [];
    const index = module.call(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.stringIndexOfInternalFuncName,
        ),
        [
            module.local.get(0, emptyStructType.typeRef),
            module.local.get(ref_index, binaryenCAPI._BinaryenTypeStringref()),
            module.local.get(str_index, binaryenCAPI._BinaryenTypeStringref()),
            module.i32.const(1),
            module.i32.const(0),
        ],
        binaryen.i32,
    );
    statementArray.push(module.return(module.f64.convert_s.i32(index)));

    return module.block('indexOf', statementArray);
}

function string_lastIndexOf_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const str_index = 2;
    const statementArray: binaryen.ExpressionRef[] = [];
    const index = module.call(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.stringIndexOfInternalFuncName,
        ),
        [
            module.local.get(0, emptyStructType.typeRef),
            module.local.get(ref_index, binaryenCAPI._BinaryenTypeStringref()),
            module.local.get(str_index, binaryenCAPI._BinaryenTypeStringref()),
            module.i32.const(0),
            module.i32.const(0),
        ],
        binaryen.i32,
    );
    statementArray.push(module.return(module.f64.convert_s.i32(index)));

    return module.block('indexOf', statementArray);
}

function string_match(module: binaryen.Module) {
    /**Args: context, this, targetStr */
    const thisStrStructIdx = 1;
    const targetStrStructIdx = 2;
    /**Locals */
    // current matched index in source string
    const matchedPosIdx = 3;
    // the string array of result
    const resStrArrayIdx = 4;
    // current begining index for search in source string
    const searchBegIdx = 5;
    // current index where a matched word will be placed in the string array
    // currently, the string array contains no more than one element
    const curStrArrayIndexIdx = 6;
    // the string that stores matched word
    const tempCharArrayIdx = 7;
    // the length of matched word
    const curStrLenIdx = 8;
    // the length of pattern to be matched
    const targetStrLenIdx = 9;

    /**1. get targetStr */
    const arrayIdxInStruct = 1;
    const targetStrStruct = module.local.get(
        targetStrStructIdx,
        stringTypeInfo.typeRef,
    );
    const targetStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        arrayIdxInStruct,
        targetStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const statementArray: binaryen.ExpressionRef[] = [];
    /**2. get length of target string */
    const targetStrLen = binaryenCAPI._BinaryenArrayLen(
        module.ptr,
        targetStrArray,
    );
    statementArray.push(module.local.set(targetStrLenIdx, targetStrLen));

    /**3. create a  string array and copy matched string to it*/

    /**3.1 create a string array */
    statementArray.push(
        module.local.set(
            resStrArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                stringArrayTypeInfo.heapTypeRef,
                module.i32.const(1),
                module.ref.null(stringTypeInfo.typeRef),
            ),
        ),
    );
    /**3.2 find a matched string and copy it to resStrArr. Currently, only a single
     * matched string will be copied.
     */
    const createNewCharArray = (module: binaryen.Module) => {
        return binaryenCAPI._BinaryenArrayNew(
            module.ptr,
            charArrayTypeInfo.heapTypeRef,
            module.local.get(curStrLenIdx, binaryen.i32),
            module.i32.const(0),
        );
    };
    const block_label_1 = 'block_label_1';
    const loop_label_1 = 'loop_block_1';
    const loop_init_1 = module.block(null, [
        module.local.set(searchBegIdx, module.i32.const(0)),
        module.local.set(curStrArrayIndexIdx, module.i32.const(0)),
    ]);

    const loop_stmts_1 = module.block(null, [
        module.local.set(
            matchedPosIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(
                        targetStrStructIdx,
                        stringTypeInfo.typeRef,
                    ),
                    module.local.get(searchBegIdx, binaryen.i32),
                ],
                binaryen.i32,
            ),
        ),
        module.if(
            module.i32.eq(
                module.local.get(matchedPosIdx, binaryen.i32),
                module.i32.const(-1),
            ),
            module.return(module.ref.null(stringArrayTypeInfo.typeRef)),
            module.local.set(
                curStrLenIdx,
                module.local.get(targetStrLenIdx, binaryen.i32),
            ),
        ),
        /** 3.2.1 create a char array */
        module.local.set(tempCharArrayIdx, createNewCharArray(module)),
        /** 3.2.2 copy matched sub-string to char array */
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(tempCharArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            targetStrArray,
            module.i32.const(0),
            module.local.get(targetStrLenIdx, binaryen.i32),
        ),

        /** 3.2.3 place char array into string array */
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            module.local.get(resStrArrayIdx, stringArrayTypeInfo.typeRef),
            module.local.get(curStrArrayIndexIdx, binaryen.i32),
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([
                    module.i32.const(0),
                    module.local.get(
                        tempCharArrayIdx,
                        charArrayTypeInfo.typeRef,
                    ),
                ]).ptr,
                2,
                stringTypeInfo.heapTypeRef,
            ),
        ),
        /**3.3 inc the idx */
        module.local.set(
            curStrArrayIndexIdx,
            module.i32.add(
                module.local.get(curStrArrayIndexIdx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
        /**jump out the loop */
        module.br(
            block_label_1,
            module.i32.eq(module.i32.const(1), module.i32.const(1)),
        ),
        /**jump to loop */
        module.local.set(
            searchBegIdx,
            module.i32.add(
                module.local.get(matchedPosIdx, binaryen.i32),
                module.local.get(targetStrLenIdx, binaryen.i32),
            ),
        ),
        module.br(loop_label_1),
    ]);
    const loop_1 = module.loop(loop_label_1, loop_stmts_1);
    const stmts_block_1 = module.block(block_label_1, [loop_init_1, loop_1]);
    statementArray.push(stmts_block_1);

    const arrayStructRef = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([
            module.local.get(resStrArrayIdx, stringArrayTypeInfo.typeRef),
            module.i32.const(1),
        ]).ptr,
        2,
        stringArrayStructTypeInfo.heapTypeRef,
    );

    statementArray.push(module.return(arrayStructRef));
    return module.block('match', statementArray);
}

// TODO: Now only return the first appreared pattern string
function string_match_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const str_index = 2;
    const match_pos_index = 3;
    const arr_index = 4;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const str = module.local.get(
        str_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const match_pos = module.local.get(match_pos_index, binaryen.i32);
    const arr = module.local.get(
        arr_index,
        stringArrayTypeInfoForStringRef.typeRef,
    );
    const statementArray: binaryen.ExpressionRef[] = [];
    const getMatchedPos = module.local.set(
        match_pos_index,
        module.call(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringIndexOfInternalFuncName,
            ),
            [
                module.local.get(0, emptyStructType.typeRef),
                ref,
                str,
                module.i32.const(1),
                module.i32.const(0),
            ],
            binaryen.i32,
        ),
    );
    statementArray.push(getMatchedPos);
    statementArray.push(
        module.local.set(
            arr_index,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                stringArrayTypeInfoForStringRef.heapTypeRef,
                module.i32.const(1),
                binaryenCAPI._BinaryenStringConst(
                    module.ptr,
                    UtilFuncs.getCString(''),
                ),
            ),
        ),
    );
    statementArray.push(
        module.if(
            module.i32.eq(match_pos, module.i32.const(-1)),
            module.return(
                binaryenCAPI._BinaryenStructNew(
                    module.ptr,
                    arrayToPtr([arr, module.i32.const(1)]).ptr,
                    2,
                    stringArrayStructTypeInfoForStringRef.heapTypeRef,
                ),
            ),
        ),
    );
    statementArray.push(
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            arr,
            module.i32.const(0),
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    ref,
                ),
                match_pos,
                module.i32.add(
                    match_pos,
                    binaryenCAPI._BinaryenStringMeasure(
                        module.ptr,
                        StringRefMeatureOp.WTF16,
                        str,
                    ),
                ),
            ),
        ),
    );
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([arr, module.i32.const(1)]).ptr,
                2,
                stringArrayStructTypeInfoForStringRef.heapTypeRef,
            ),
        ),
    );
    return module.block('match', statementArray);
}

function string_search(module: binaryen.Module) {
    /**Args: context, this, pattern */
    const thisStrStructIdx = 1;
    const targetStrStructIdx = 2;
    /**Locals */
    // 1.index of matched position
    const matchedPosIdx = 3;
    const statementArray: binaryen.ExpressionRef[] = [];
    const findPattern = module.block(null, [
        module.local.set(
            matchedPosIdx,
            module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.stringIndexOfInternalFuncName,
                ),
                [
                    module.local.get(0, emptyStructType.typeRef),
                    module.local.get(thisStrStructIdx, stringTypeInfo.typeRef),
                    module.local.get(
                        targetStrStructIdx,
                        stringTypeInfo.typeRef,
                    ),
                    module.i32.const(0),
                ],
                binaryen.i32,
            ),
        ),
        module.return(
            module.f64.convert_s.i32(
                module.local.get(matchedPosIdx, binaryen.i32),
            ),
        ),
    ]);
    statementArray.push(findPattern);
    return module.block('search', statementArray);
}

// TODO: Now it works as string.indexOf
function string_search_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const str_index = 2;
    const statementArray: binaryen.ExpressionRef[] = [];
    const index = module.call(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.stringIndexOfInternalFuncName,
        ),
        [
            module.local.get(0, emptyStructType.typeRef),
            module.local.get(ref_index, binaryenCAPI._BinaryenTypeStringref()),
            module.local.get(str_index, binaryenCAPI._BinaryenTypeStringref()),
            module.i32.const(1),
            module.i32.const(0),
        ],
        binaryen.i32,
    );
    statementArray.push(module.return(module.f64.convert_s.i32(index)));

    return module.block('search', statementArray);
}

function string_charAt(module: binaryen.Module) {
    const statementArray: binaryen.ExpressionRef[] = [];

    /** Args: context, this, index */
    const thisStrStructIdx = 1;
    const paramIdx = 2;
    const newStrArrayIdx = 3;

    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );

    const strArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const strLen = binaryenCAPI._BinaryenArrayLen(module.ptr, strArray);

    const index = module.i32.trunc_s.f64(
        module.local.get(paramIdx, binaryen.f64),
    );

    const judgment = module.if(
        module.i32.ge_s(index, module.i32.const(0)),
        module.if(
            module.i32.le_s(index, module.i32.sub(strLen, module.i32.const(1))),
            module.block(null, [
                module.local.set(
                    newStrArrayIdx,
                    binaryenCAPI._BinaryenArrayNew(
                        module.ptr,
                        charArrayTypeInfo.heapTypeRef,
                        module.i32.const(1),
                        module.i32.const(0),
                    ),
                ),
                binaryenCAPI._BinaryenArrayCopy(
                    module.ptr,
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                    module.i32.const(0),
                    strArray,
                    index,
                    module.i32.const(1),
                ),
                module.return(
                    binaryenCAPI._BinaryenStructNew(
                        module.ptr,
                        arrayToPtr([
                            module.i32.const(0),
                            module.local.get(
                                newStrArrayIdx,
                                charArrayTypeInfo.typeRef,
                            ),
                        ]).ptr,
                        2,
                        stringTypeInfo.heapTypeRef,
                    ),
                ),
            ]),
            module.block(null, [
                module.local.set(
                    newStrArrayIdx,
                    binaryenCAPI._BinaryenArrayNew(
                        module.ptr,
                        charArrayTypeInfo.heapTypeRef,
                        module.i32.const(0),
                        module.i32.const(0),
                    ),
                ),
                module.return(
                    binaryenCAPI._BinaryenStructNew(
                        module.ptr,
                        arrayToPtr([
                            module.i32.const(0),
                            module.local.get(
                                newStrArrayIdx,
                                charArrayTypeInfo.typeRef,
                            ),
                        ]).ptr,
                        2,
                        stringTypeInfo.heapTypeRef,
                    ),
                ),
            ]),
        ),
        module.block(null, [
            module.local.set(
                newStrArrayIdx,
                binaryenCAPI._BinaryenArrayNew(
                    module.ptr,
                    charArrayTypeInfo.heapTypeRef,
                    module.i32.const(0),
                    module.i32.const(0),
                ),
            ),
            module.return(
                binaryenCAPI._BinaryenStructNew(
                    module.ptr,
                    arrayToPtr([
                        module.i32.const(0),
                        module.local.get(
                            newStrArrayIdx,
                            charArrayTypeInfo.typeRef,
                        ),
                    ]).ptr,
                    2,
                    stringTypeInfo.heapTypeRef,
                ),
            ),
        ]),
    );

    statementArray.push(judgment);

    /* generate block, return block */
    statementArray.push(module.return(thisStrStruct));
    const charAtBlock = module.block('string_charAt', statementArray);
    return charAtBlock;
}

function string_charAt_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const index_index = 2;
    const index_i32_index = 3;
    const len_index = 4;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const index_i32 = module.local.get(index_i32_index, binaryen.i32);
    const len = module.local.get(len_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(
        module.local.set(
            index_i32_index,
            module.i32.trunc_s_sat.f64(
                module.local.get(index_index, binaryen.f64),
            ),
        ),
    );
    statementArray.push(
        module.local.set(
            len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                ref,
            ),
        ),
    );
    statementArray.push(
        module.if(
            module.i32.or(
                module.i32.lt_s(index_i32, module.i32.const(0)),
                module.i32.ge_s(index_i32, len),
            ),
            module.return(
                binaryenCAPI._BinaryenStringConst(
                    module.ptr,
                    UtilFuncs.getCString(''),
                ),
            ),
        ),
    );
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    ref,
                ),
                index_i32,
                module.i32.add(index_i32, module.i32.const(1)),
            ),
        ),
    );
    return module.block('string_charAt', statementArray);
}

function string_substring_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const start_index = 2;
    const end_index = 3;
    const start_i32_index = 4;
    const end_i32_index = 5;
    const len_index = 6;
    const temp_index = 7; // swap when start < end, like substring(3, 1)
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const start = module.local.get(start_index, binaryen.f64);
    const end = module.local.get(end_index, binaryen.anyref);
    const start_i32 = module.local.get(start_i32_index, binaryen.i32);
    const end_i32 = module.local.get(end_i32_index, binaryen.i32);
    const len = module.local.get(len_index, binaryen.i32);
    const temp = module.local.get(temp_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(
        module.local.set(
            len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                ref,
            ),
        ),
    );
    statementArray.push(
        module.local.set(start_i32_index, module.i32.trunc_s_sat.f64(start)),
    );
    statementArray.push(
        module.if(
            module.i32.lt_s(start_i32, module.i32.const(0)),
            module.local.set(start_i32_index, module.i32.const(0)),
            module.if(
                module.i32.ge_s(start_i32, len),
                module.local.set(start_i32_index, len),
            ),
        ),
    );
    const isUndefined = FunctionalFuncs.isBaseType(
        module,
        end,
        dyntype.dyntype_is_undefined,
    );
    const num = module.i32.trunc_s_sat.f64(
        module.call(
            dyntype.dyntype_to_number,
            [FunctionalFuncs.getDynContextRef(module), end],
            binaryen.f64,
        ),
    );
    statementArray.push(
        module.if(
            isUndefined,
            module.local.set(end_i32_index, len),
            module.local.set(end_i32_index, num),
        ),
    );
    statementArray.push(
        module.if(
            module.i32.lt_s(end_i32, module.i32.const(0)),
            module.local.set(end_i32_index, module.i32.const(0)),
            module.if(
                module.i32.ge_s(end_i32, len),
                module.local.set(end_i32_index, len),
            ),
        ),
    );
    statementArray.push(
        module.if(
            module.i32.gt_s(start_i32, end_i32),
            module.block(null, [
                module.local.set(temp_index, start_i32),
                module.local.set(start_i32_index, end_i32),
                module.local.set(end_i32_index, temp),
            ]),
        ),
    );
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStringSliceWTF(
                module.ptr,
                StringRefSliceOp.WTF16,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    ref,
                ),
                start_i32,
                end_i32,
            ),
        ),
    );
    return module.block('substring', statementArray);
}

function string_charCodeAt_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const pos_index = 2;
    const pos_i32_index = 3;
    const len_index = 4;
    const char_code_index = 5;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const pos = module.local.get(pos_index, binaryen.f64);
    const pos_i32 = module.local.get(pos_i32_index, binaryen.i32);
    const len = module.local.get(len_index, binaryen.i32);
    const char_code = module.local.get(char_code_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(
        module.local.set(
            len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                ref,
            ),
        ),
    );
    statementArray.push(
        module.local.set(pos_i32_index, module.i32.trunc_s_sat.f64(pos)),
    );
    statementArray.push(
        module.if(
            module.i32.or(
                module.i32.lt_s(pos_i32, module.i32.const(0)),
                module.i32.ge_s(pos_i32, len),
            ),
            module.return(module.f64.const(NaN)),
        ),
    );
    statementArray.push(
        module.local.set(
            char_code_index,
            binaryenCAPI._BinaryenStringWTF16Get(
                module.ptr,
                binaryenCAPI._BinaryenStringAs(
                    module.ptr,
                    StringRefAsOp.WTF16,
                    ref,
                ),
                pos_i32,
            ),
        ),
    );
    statementArray.push(module.return(module.f64.convert_s.i32(char_code)));

    return module.block('charCodeAt', statementArray);
}

function string_toLowerCase(module: binaryen.Module) {
    return string_toLowerOrUpperCase_internal(module, true);
}

function string_toLowerCase_stringref(module: binaryen.Module) {
    return module.unreachable();
}

function string_toUpperCase(module: binaryen.Module) {
    return string_toLowerOrUpperCase_internal(module, false);
}

function string_toUpperCase_stringref(module: binaryen.Module) {
    return module.unreachable();
}

function string_toLowerOrUpperCase_internal(
    module: binaryen.Module,
    lower: boolean,
) {
    const statementArray: binaryen.ExpressionRef[] = [];

    const strIdx = 1;
    const for_i_Idx = 2;
    const newStrArrayIdx = 3;
    const copyCurLenIdx = 4;
    const paramIdx = 5;
    const str = module.local.get(strIdx, stringTypeInfo.typeRef);

    const newStrArrayType = charArrayTypeInfo.typeRef;

    const thisStrArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        str,
        charArrayTypeInfo.typeRef,
        false,
    );

    const thisStrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray);

    if (lower == true) {
        statementArray.push(module.local.set(paramIdx, module.i32.const(1)));
    } else {
        statementArray.push(module.local.set(paramIdx, module.i32.const(0)));
    }

    statementArray.push(
        module.local.set(
            newStrArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                charArrayTypeInfo.heapTypeRef,
                thisStrLen,
                module.i32.const(0),
            ),
        ),
    );

    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            thisStrArray,
            module.i32.const(0),
            thisStrLen,
        ),
    );
    statementArray.push(module.local.set(copyCurLenIdx, thisStrLen));

    const strArray = binaryenCAPI._BinaryenStructNew(
        module.ptr,
        arrayToPtr([
            module.i32.const(0),
            module.local.get(newStrArrayIdx, newStrArrayType),
        ]).ptr,
        2,
        stringTypeInfo.heapTypeRef,
    );

    const strLen = binaryenCAPI._BinaryenArrayLen(module.ptr, thisStrArray);

    const for_label_1 = 'for_loop_1_block';
    const for_init_1 = module.local.set(for_i_Idx, module.i32.const(0));
    const for_condition_1 = module.i32.lt_u(
        module.local.get(for_i_Idx, binaryen.i32),
        strLen,
    );
    const for_incrementor_1 = module.local.set(
        for_i_Idx,
        module.i32.add(
            module.local.get(for_i_Idx, binaryen.i32),
            module.i32.const(1),
        ),
    );

    const for_body_1 = module.if(
        module.i32.eq(
            module.local.get(paramIdx, binaryen.i32),
            module.i32.const(1),
        ),
        module.if(
            module.i32.ge_u(
                binaryenCAPI._BinaryenArrayGet(
                    module.ptr,
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                    module.local.get(for_i_Idx, binaryen.i32),
                    charArrayTypeInfo.typeRef,
                    false,
                ),
                module.i32.const(65),
            ),
            module.if(
                module.i32.le_u(
                    binaryenCAPI._BinaryenArrayGet(
                        module.ptr,
                        module.local.get(
                            newStrArrayIdx,
                            charArrayTypeInfo.typeRef,
                        ),
                        module.local.get(for_i_Idx, binaryen.i32),
                        charArrayTypeInfo.typeRef,
                        false,
                    ),
                    module.i32.const(90),
                ),
                binaryenCAPI._BinaryenArraySet(
                    module.ptr,
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                    module.local.get(for_i_Idx, binaryen.i32),
                    module.i32.add(
                        binaryenCAPI._BinaryenArrayGet(
                            module.ptr,
                            module.local.get(
                                newStrArrayIdx,
                                charArrayTypeInfo.typeRef,
                            ),
                            module.local.get(for_i_Idx, binaryen.i32),
                            charArrayTypeInfo.typeRef,
                            false,
                        ),
                        module.i32.const(32),
                    ),
                ),
            ),
        ),
        module.if(
            module.i32.ge_u(
                binaryenCAPI._BinaryenArrayGet(
                    module.ptr,
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                    module.local.get(for_i_Idx, binaryen.i32),
                    charArrayTypeInfo.typeRef,
                    false,
                ),
                module.i32.const(97),
            ),
            module.if(
                module.i32.le_u(
                    binaryenCAPI._BinaryenArrayGet(
                        module.ptr,
                        module.local.get(
                            newStrArrayIdx,
                            charArrayTypeInfo.typeRef,
                        ),
                        module.local.get(for_i_Idx, binaryen.i32),
                        charArrayTypeInfo.typeRef,
                        false,
                    ),
                    module.i32.const(122),
                ),
                binaryenCAPI._BinaryenArraySet(
                    module.ptr,
                    module.local.get(newStrArrayIdx, charArrayTypeInfo.typeRef),
                    module.local.get(for_i_Idx, binaryen.i32),
                    module.i32.sub(
                        binaryenCAPI._BinaryenArrayGet(
                            module.ptr,
                            module.local.get(
                                newStrArrayIdx,
                                charArrayTypeInfo.typeRef,
                            ),
                            module.local.get(for_i_Idx, binaryen.i32),
                            charArrayTypeInfo.typeRef,
                            false,
                        ),
                        module.i32.const(32),
                    ),
                ),
            ),
        ),
    );

    const flattenLoop_1: FlattenLoop = {
        label: for_label_1,
        condition: for_condition_1,
        statements: for_body_1,
        incrementor: for_incrementor_1,
    };
    statementArray.push(for_init_1);
    statementArray.push(
        module.loop(
            for_label_1,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop_1,
                SemanticsKind.FOR,
            ),
        ),
    );

    statementArray.push(module.return(strArray));

    const toLowerOrUpperCaseinternalBlock = module.block(
        'toLowerOrUpperCaseinternal',
        statementArray,
    );
    return toLowerOrUpperCaseinternalBlock;
}

function string_trim(module: binaryen.Module) {
    const thisStrStructIdx = 1;
    const for_i_Idx = 2;
    const newStrCharArrayIdx = 3;
    const trimStartIdx = 4;
    const trimEndIdx = 5;

    const thisStrStruct = module.local.get(
        thisStrStructIdx,
        stringTypeInfo.typeRef,
    );
    const thisStrCharArray = binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        thisStrStruct,
        charArrayTypeInfo.typeRef,
        false,
    );
    const thisStrLen = binaryenCAPI._BinaryenArrayLen(
        module.ptr,
        thisStrCharArray,
    );

    const statementArray: binaryen.ExpressionRef[] = [];

    /**if the array is empty */
    const stringIsEmpty = module.if(
        module.i32.eq(thisStrLen, module.i32.const(0)),
        module.return(thisStrStruct),
    );
    statementArray.push(stringIsEmpty);

    /**loop1 */
    const block_label_1 = 'block_label_1';
    const loop_label_1 = 'loop_label_1';

    const loop_init_1 = module.block(null, [
        module.local.set(trimStartIdx, module.i32.const(0)),
        module.local.set(for_i_Idx, module.i32.const(0)),
    ]);
    const loop_stmts_1 = module.block(null, [
        module.if(
            module.i32.ne(
                binaryenCAPI._BinaryenArrayGet(
                    module.ptr,
                    thisStrCharArray,
                    module.local.get(for_i_Idx, binaryen.i32),
                    charArrayTypeInfo.typeRef,
                    false,
                ),
                module.i32.const(32),
            ),
            module.block(null, [
                module.local.set(
                    trimStartIdx,
                    module.local.get(for_i_Idx, binaryen.i32),
                ),
                /**jump out the loop */
                module.br(block_label_1),
            ]),
        ),
        /**inc i */
        module.local.set(
            for_i_Idx,
            module.i32.add(
                module.local.get(for_i_Idx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
        /**jump out the loop */
        module.br(
            block_label_1,
            module.i32.ge_s(
                module.local.get(for_i_Idx, binaryen.i32),
                thisStrLen,
            ),
        ),
        /**jump to loop */
        module.br(loop_label_1),
    ]);
    const loop_1 = module.loop(loop_label_1, loop_stmts_1);
    const stmts_block_1 = module.block(block_label_1, [loop_init_1, loop_1]);
    statementArray.push(stmts_block_1);

    /**loop2 */
    const block_label_2 = 'block_label_2';
    const loop_label_2 = 'loop_label_2';

    const loop_init_2 = module.block(null, [
        module.local.set(
            trimEndIdx,
            module.i32.sub(thisStrLen, module.i32.const(1)),
        ),
        module.local.set(
            for_i_Idx,
            module.i32.sub(thisStrLen, module.i32.const(1)),
        ),
    ]);
    const loop_stmts_2 = module.block(null, [
        module.if(
            module.i32.ne(
                binaryenCAPI._BinaryenArrayGet(
                    module.ptr,
                    thisStrCharArray,
                    module.local.get(for_i_Idx, binaryen.i32),
                    charArrayTypeInfo.typeRef,
                    false,
                ),
                module.i32.const(32),
            ),
            module.block(null, [
                module.local.set(
                    trimEndIdx,
                    module.local.get(for_i_Idx, binaryen.i32),
                ),
                /**jump out the loop */
                module.br(block_label_2),
            ]),
        ),
        /**dec i */
        module.local.set(
            for_i_Idx,
            module.i32.sub(
                module.local.get(for_i_Idx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
        /**jump out the loop */
        module.br(
            block_label_2,
            module.i32.le_s(
                module.local.get(for_i_Idx, binaryen.i32),
                module.i32.const(-1),
            ),
        ),
        /**jump to loop */
        module.br(loop_label_2),
    ]);
    const loop_2 = module.loop(loop_label_2, loop_stmts_2);
    const stmts_block_2 = module.block(block_label_2, [loop_init_2, loop_2]);
    statementArray.push(stmts_block_2);

    /**copy the array between trimStart and trimEnd */
    const newStrLen = module.i32.add(
        module.i32.sub(
            module.local.get(trimEndIdx, binaryen.i32),
            module.local.get(trimStartIdx, binaryen.i32),
        ),
        module.i32.const(1),
    );

    statementArray.push(
        module.local.set(
            newStrCharArrayIdx,
            binaryenCAPI._BinaryenArrayNew(
                module.ptr,
                charArrayTypeInfo.heapTypeRef,
                newStrLen,
                module.i32.const(0),
            ),
        ),
    );
    statementArray.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(newStrCharArrayIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            thisStrCharArray,
            module.local.get(trimStartIdx, binaryen.i32),
            newStrLen,
        ),
    );
    statementArray.push(
        module.return(
            binaryenCAPI._BinaryenStructNew(
                module.ptr,
                arrayToPtr([
                    module.i32.const(0),
                    module.local.get(
                        newStrCharArrayIdx,
                        charArrayTypeInfo.typeRef,
                    ),
                ]).ptr,
                2,
                stringTypeInfo.heapTypeRef,
            ),
        ),
    );
    const trimBlock = module.block('string_trim', statementArray);
    return trimBlock;
}

function string_trim_stringref(module: binaryen.Module) {
    const ref_index = 1;
    const start_index = 2;
    const end_index = 3;
    const len_index = 4;
    const ref = module.local.get(
        ref_index,
        binaryenCAPI._BinaryenTypeStringref(),
    );
    const start = module.local.get(start_index, binaryen.i32);
    const end = module.local.get(end_index, binaryen.i32);
    const len = module.local.get(len_index, binaryen.i32);
    const statementArray: binaryen.ExpressionRef[] = [];

    statementArray.push(
        module.local.set(
            len_index,
            binaryenCAPI._BinaryenStringMeasure(
                module.ptr,
                StringRefMeatureOp.WTF16,
                ref,
            ),
        ),
    );
    statementArray.push(
        module.if(module.i32.eq(len, module.i32.const(0)), module.return(ref)),
    );
    statementArray.push(module.local.set(start_index, module.i32.const(0)));
    statementArray.push(
        module.local.set(end_index, module.i32.sub(len, module.i32.const(1))),
    );
    let loop_index = 0;
    const while_loop = (
        indexRef: binaryenCAPI.ExpressionRef,
        index: number,
        boundRef: binaryenCAPI.ExpressionRef,
        from_start: boolean,
    ) => {
        const char = module.call(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringcharAtFuncName,
            ),
            [
                module.local.get(0, emptyStructType.typeRef),
                ref,
                module.f64.convert_u.i32(indexRef),
            ],
            binaryenCAPI._BinaryenTypeStringref(),
        );
        const accessBound = from_start
            ? module.i32.le_u(indexRef, boundRef)
            : module.i32.ge_u(indexRef, boundRef);
        const loopLabel = `while_loop_${loop_index++}`;
        const loopCond = module.i32.and(
            accessBound,
            binaryenCAPI._BinaryenStringEq(
                module.ptr,
                StringRefEqOp.EQ,
                char,
                binaryenCAPI._BinaryenStringConst(
                    module.ptr,
                    UtilFuncs.getCString(' '),
                ),
            ),
        );
        const loopStmts = module.block(null, [
            module.local.set(
                index,
                from_start
                    ? module.i32.add(indexRef, module.i32.const(1))
                    : module.i32.sub(indexRef, module.i32.const(1)),
            ),
        ]);
        const flattenLoop: FlattenLoop = {
            label: loopLabel,
            condition: loopCond,
            statements: loopStmts,
        };
        return module.loop(
            loopLabel,
            FunctionalFuncs.flattenLoopStatement(
                module,
                flattenLoop,
                SemanticsKind.WHILE,
            ),
        );
    };
    statementArray.push(while_loop(start, start_index, end, true));
    statementArray.push(while_loop(end, end_index, start, false));
    statementArray.push(
        binaryenCAPI._BinaryenStringSliceWTF(
            module.ptr,
            StringRefSliceOp.WTF16,
            binaryenCAPI._BinaryenStringAs(
                module.ptr,
                StringRefAsOp.WTF16,
                ref,
            ),
            start,
            module.i32.add(end, module.i32.const(1)),
        ),
    );
    return module.block('string_trim', statementArray);
}

function Array_isArray(module: binaryen.Module) {
    /** Args: context, this, any */
    /* workaround: interface's method has the @this param */
    const paramAnyIdx = 2;
    /** Locals: returnIdx */
    const returnIdx = 3;

    const param = module.local.get(paramAnyIdx, binaryen.anyref);
    const statementArray: binaryen.ExpressionRef[] = [];

    const setDefault = module.local.set(returnIdx, module.i32.const(0));
    const setTrue = module.local.set(returnIdx, module.i32.const(1));
    const returnStmt = module.return(module.local.get(returnIdx, binaryen.i32));

    const dynTypeIsArray = module.call(
        dyntype.dyntype_is_array,
        [module.global.get(dyntype.dyntype_context, dyntype.dyn_ctx_t), param],
        dyntype.bool,
    );
    const is_array = module.if(
        module.i32.eq(dynTypeIsArray, dyntype.bool_true),
        setTrue,
    );
    const is_arr_extref = module.call(
        dyntype.dyntype_typeof1,
        [
            module.global.get(dyntype.dyntype_context, dyntype.dyn_value_t),
            param,
        ],
        binaryen.i32,
    );
    const is_any_array = module.if(
        module.i32.eq(
            module.local.get(returnIdx, binaryen.i32),
            module.i32.const(0),
        ),
        /** 13 is EXArray tag in quickjs */
        module.if(module.i32.eq(is_arr_extref, module.i32.const(13)), setTrue),
    );
    statementArray.push(setDefault);
    statementArray.push(is_array);
    statementArray.push(is_any_array);
    statementArray.push(returnStmt);

    return module.block(null, statementArray);
}

function allocExtRefTableSlot(module: binaryen.Module) {
    const objIdx = 0;
    const tableIdx = 1;
    const loopIdx = 2;
    const tmpMaskArrIdx = 3;

    const arrName = getBuiltInFuncName(BuiltinNames.extRefTableMaskArr);
    const maskArr = binaryenCAPI._BinaryenGlobalGet(
        module.ptr,
        UtilFuncs.getCString(arrName),
        charArrayTypeInfo.typeRef,
    );
    const newArray = binaryenCAPI._BinaryenArrayNew(
        module.ptr,
        charArrayTypeInfo.heapTypeRef,
        binaryenCAPI._BinaryenTableSize(
            module.ptr,
            UtilFuncs.getCString(BuiltinNames.extrefTable),
        ),
        module.i32.const(0),
    );
    const tableGrow = binaryenCAPI._BinaryenTableGrow(
        module.ptr,
        UtilFuncs.getCString(BuiltinNames.extrefTable),
        FunctionalFuncs.getEmptyRef(module),
        module.i32.const(BuiltinNames.tableGrowDelta),
    );
    const stmts: binaryen.ExpressionRef[] = [];
    stmts.push(module.local.set(tableIdx, module.i32.const(-1)));
    stmts.push(module.local.set(loopIdx, module.i32.const(0)));
    stmts.push(
        module.if(
            module.ref.is_null(maskArr),
            module.block(null, [
                tableGrow,
                binaryenCAPI._BinaryenGlobalSet(
                    module.ptr,
                    UtilFuncs.getCString(arrName),
                    newArray,
                ),
            ]),
        ),
    );
    const maskArrLen = binaryenCAPI._BinaryenArrayLen(module.ptr, maskArr);
    const loopBlock = 'look_block';
    const loopLabel = 'for_loop';
    const loopBlockStmts: binaryen.ExpressionRef[] = [];
    const loopStmts: binaryen.ExpressionRef[] = [];
    const loopCond = module.i32.lt_u(
        module.local.get(loopIdx, binaryen.i32),
        maskArrLen,
    );
    const ifBlockStmts: binaryen.ExpressionRef[] = [];
    ifBlockStmts.push(
        module.if(
            module.i32.eq(
                binaryenCAPI._BinaryenArrayGet(
                    module.ptr,
                    maskArr,
                    module.local.get(loopIdx, binaryen.i32),
                    charArrayTypeInfo.typeRef,
                    false,
                ),
                module.i32.const(0),
            ),
            module.block(null, [
                module.local.set(
                    tableIdx,
                    module.local.get(loopIdx, binaryen.i32),
                ),
                module.br(loopBlock),
            ]),
        ),
    );
    loopStmts.push(module.block(null, ifBlockStmts));
    loopStmts.push(
        module.local.set(
            loopIdx,
            module.i32.add(
                module.local.get(loopIdx, binaryen.i32),
                module.i32.const(1),
            ),
        ),
    );
    loopStmts.push(module.br(loopLabel));
    loopBlockStmts.push(
        module.loop(
            loopLabel,
            module.if(loopCond, module.block(null, loopStmts)),
        ),
    );
    stmts.push(module.block(loopBlock, loopBlockStmts));

    const ifStmts2: binaryen.ExpressionRef[] = [];
    ifStmts2.push(tableGrow);
    ifStmts2.push(module.local.set(tableIdx, maskArrLen));
    ifStmts2.push(module.local.set(tmpMaskArrIdx, newArray));
    ifStmts2.push(
        binaryenCAPI._BinaryenArrayCopy(
            module.ptr,
            module.local.get(tmpMaskArrIdx, charArrayTypeInfo.typeRef),
            module.i32.const(0),
            maskArr,
            module.i32.const(0),
            maskArrLen,
        ),
    );
    ifStmts2.push(
        binaryenCAPI._BinaryenGlobalSet(
            module.ptr,
            UtilFuncs.getCString(arrName),
            module.local.get(tmpMaskArrIdx, charArrayTypeInfo.typeRef),
        ),
    );
    stmts.push(
        module.if(
            module.i32.eq(
                module.local.get(tableIdx, binaryen.i32),
                module.i32.const(-1),
            ),
            module.block(null, ifStmts2),
        ),
    );
    const tableSetOp = binaryenCAPI._BinaryenTableSet(
        module.ptr,
        UtilFuncs.getCString(BuiltinNames.extrefTable),
        module.local.get(tableIdx, binaryen.i32),
        module.local.get(objIdx, binaryen.anyref),
    );
    stmts.push(tableSetOp);
    stmts.push(
        binaryenCAPI._BinaryenArraySet(
            module.ptr,
            maskArr,
            module.local.get(tableIdx, binaryen.i32),
            module.i32.const(1),
        ),
    );

    stmts.push(module.return(module.local.get(tableIdx, binaryen.i32)));
    return module.block(null, stmts);
}

/** to extref with runtime getting table index */
function newExtRef(module: binaryen.Module) {
    const _context_unused = 0;
    const objTagIdx = 1;
    const objIdx = 2;

    /* alloc table slot */
    const tableIdx = module.call(
        getBuiltInFuncName(BuiltinNames.allocExtRefTableSlot),
        [module.local.get(objIdx, binaryen.anyref)],
        dyntype.int,
    );

    /* create extref */
    const call = module.call(
        dyntype.dyntype_new_extref,
        [
            binaryenCAPI._BinaryenGlobalGet(
                module.ptr,
                UtilFuncs.getCString(dyntype.dyntype_context),
                binaryen.anyref,
            ),
            tableIdx,
            module.local.get(objTagIdx, binaryen.i32),
        ],
        dyntype.dyn_value_t,
    );

    return module.return(call);
}

export function callBuiltInAPIs(module: binaryen.Module) {
    /** Math.sqrt */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.mathSqrtFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.f64,
        ]),
        binaryen.f64,
        [],
        module.f64.sqrt(module.local.get(2, binaryen.f64)),
    );
    /** Math.abs */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.mathAbsFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.f64,
        ]),
        binaryen.f64,
        [],
        module.f64.abs(module.local.get(2, binaryen.f64)),
    );
    /** Math.ceil */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.mathCeilFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.f64,
        ]),
        binaryen.f64,
        [],
        module.f64.ceil(module.local.get(2, binaryen.f64)),
    );
    /** Math.floor */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.mathFloorFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.f64,
        ]),
        binaryen.f64,
        [],
        module.f64.floor(module.local.get(2, binaryen.f64)),
    );
    /** Math.trunc */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.mathTruncFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.f64,
        ]),
        binaryen.f64,
        [],
        module.f64.trunc(module.local.get(2, binaryen.f64)),
    );
    /** Array.isArray */
    module.addFunction(
        UtilFuncs.getFuncName(
            BuiltinNames.builtinModuleName,
            BuiltinNames.arrayIsArrayFuncName,
        ),
        binaryen.createType([
            emptyStructType.typeRef,
            emptyStructType.typeRef,
            binaryen.anyref,
        ]),
        binaryen.i32,
        [binaryen.i32],
        Array_isArray(module),
    );
    /** anyref */
    module.addFunction(
        getBuiltInFuncName(BuiltinNames.anyrefCond),
        binaryen.createType([binaryen.anyref]),
        binaryen.i32,
        [],
        anyrefCond(module),
    );
    module.addFunction(
        getBuiltInFuncName(BuiltinNames.allocExtRefTableSlot),
        binaryen.createType([binaryen.anyref]),
        binaryen.i32,
        [binaryen.i32, binaryen.i32, charArrayTypeInfo.typeRef],
        allocExtRefTableSlot(module),
    );
    module.addFunction(
        getBuiltInFuncName(BuiltinNames.newExtRef),
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.external_ref_tag,
            binaryen.anyref,
        ]),
        binaryen.anyref,
        [],
        newExtRef(module),
    );
    module.addFunctionExport(
        getBuiltInFuncName(BuiltinNames.allocExtRefTableSlot),
        BuiltinNames.allocExtRefTableSlot,
    );
    /** string */
    if (getConfig().enableStringRef) {
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringConcatFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                stringArrayStructTypeInfoForStringRef.typeRef,
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.i32,
                binaryen.i32,
                stringArrayTypeInfoForStringRef.typeRef,
            ],
            string_concat_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringEQFuncName,
            ),
            binaryen.createType([
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryen.i32,
            [],
            string_eq_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSliceFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.anyref,
                binaryen.anyref,
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryenCAPI._BinaryenTypeStringviewWTF16(),
            ],
            string_slice_stringref(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringcharAtFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.f64,
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [binaryen.i32, binaryen.i32],
            string_charAt_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringIndexOfInternalFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.i32,
                binaryen.i32,
            ]),
            binaryen.i32,
            [
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.i32,
                binaryen.i32,
            ],
            string_indexOf_internal_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringIndexOfFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryen.f64,
            [],
            string_indexOf_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringLastIndexOfFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryen.f64,
            [],
            string_lastIndexOf_stringref(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtrimFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [binaryen.i32, binaryen.i32, binaryen.i32],
            string_trim_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSplitFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            stringArrayStructTypeInfoForStringRef.typeRef,
            [
                stringArrayTypeInfoForStringRef.typeRef,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryenCAPI._BinaryenTypeStringref(),
            ],
            string_split_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringMatchFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            stringArrayStructTypeInfoForStringRef.typeRef,
            [binaryen.i32, stringArrayTypeInfoForStringRef.typeRef],
            string_match_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSearchFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryen.f64,
            [],
            string_search_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringReplaceFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [binaryen.i32, binaryen.i32],
            string_replace_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSubStringFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.f64,
                binaryen.anyref,
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32],
            string_substring_stringref(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringCharCodeAtFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
                binaryen.f64,
            ]),
            binaryen.f64,
            [binaryen.i32, binaryen.i32, binaryen.i32],
            string_charCodeAt_stringref(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtoLowerCaseFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [],
            string_toLowerCase_stringref(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtoUpperCaseFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                binaryenCAPI._BinaryenTypeStringref(),
            ]),
            binaryenCAPI._BinaryenTypeStringref(),
            [],
            string_toUpperCase_stringref(module),
        );
        /** For now, here should enable --enableStringref flag to get prop name
         * through meta
         */
        module.addFunction(
            getUtilsFuncName(BuiltinNames.getPropNamesByMeta),
            baseStructType.typeRef,
            stringArrayStructTypeInfoForStringRef.typeRef,
            [
                stringArrayTypeInfoForStringRef.typeRef,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
            ],
            getPropNameThroughMeta(module),
        );
    } else {
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringConcatFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringArrayStructTypeInfo.typeRef,
            ]),
            stringTypeInfo.typeRef,
            [
                binaryen.i32,
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
            ],
            string_concat(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringEQFuncName,
            ),
            binaryen.createType([
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            binaryen.i32,
            [binaryen.i32],
            string_eq(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSliceFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                binaryen.anyref,
                binaryen.anyref,
            ]),
            stringTypeInfo.typeRef,
            [binaryen.i32, binaryen.i32, charArrayTypeInfo.typeRef],
            string_slice(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringcharAtFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                binaryen.f64,
            ]),
            stringTypeInfo.typeRef,
            [charArrayTypeInfo.typeRef],
            string_charAt(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringIndexOfFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            binaryen.f64,
            [binaryen.i32, binaryen.i32, binaryen.i32],
            string_indexOf(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringIndexOfInternalFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
                binaryen.i32,
            ]),
            binaryen.i32,
            [
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
            ],
            string_indexOf_internal(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtrimFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringTypeInfo.typeRef,
            [
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
            ],
            string_trim(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSplitFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringArrayStructTypeInfo.typeRef,
            [
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                binaryen.i32,
                stringArrayTypeInfo.typeRef,
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
            ],
            string_split(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringMatchFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringArrayStructTypeInfo.typeRef,
            [
                binaryen.i32,
                stringArrayTypeInfo.typeRef,
                binaryen.i32,
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
                binaryen.i32,
            ],
            string_match(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringSearchFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            binaryen.f64,
            [binaryen.i32, binaryen.f64],
            string_search(module),
        );
        module.addFunction(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringReplaceFuncName,
            ),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringTypeInfo.typeRef,
            [charArrayTypeInfo.typeRef, binaryen.i32],
            string_replace(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtoLowerCaseFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringTypeInfo.typeRef,
            [
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
                binaryen.i32,
            ],
            string_toLowerCase(module),
        );
        module.addFunction(
            getBuiltInFuncName(BuiltinNames.stringtoUpperCaseFuncName),
            binaryen.createType([
                emptyStructType.typeRef,
                stringTypeInfo.typeRef,
            ]),
            stringTypeInfo.typeRef,
            [
                binaryen.i32,
                charArrayTypeInfo.typeRef,
                binaryen.i32,
                binaryen.i32,
            ],
            string_toUpperCase(module),
        );
    }
    /** array */

    /* e.g. array.push can be implemented by a single native API,
        since the native API doesn't directly receive or return element of
        the array, there is no need to do specialization for function type */
    addArrayMethod(
        module,
        'push',
        BuiltinNames.arrayPushFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.f64,
    );
    /* e.g. array.pop's return type is T, must be implemented through multiple
        native APIs to handle value types (i32, i64, ...) and ref type (anyref) */
    addArrayMethod(
        module,
        'pop',
        BuiltinNames.arrayPopFuncNames,
        false,
        [binaryen.anyref],
        null,
    );
    addArrayMethod(
        module,
        'join',
        BuiltinNames.arrayJoinFuncNames,
        false,
        [binaryen.anyref, binaryen.anyref],
        getConfig().enableStringRef
            ? binaryenCAPI._BinaryenTypeStringref()
            : stringTypeInfo.typeRef,
    );
    addArrayMethod(
        module,
        'concat',
        BuiltinNames.arrayConcatFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'reverse',
        BuiltinNames.arrayReverseFuncNames,
        true,
        [binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'shift',
        BuiltinNames.arrayShiftFuncNames,
        false,
        [binaryen.anyref],
        null,
    );
    addArrayMethod(
        module,
        'slice',
        BuiltinNames.arraySliceFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'sort',
        BuiltinNames.arraySortFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'splice',
        BuiltinNames.arraySpliceFuncNames,
        true,
        [binaryen.anyref, binaryen.f64, binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'unshift',
        BuiltinNames.arrayUnshiftFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.f64,
    );
    addArrayMethod(
        module,
        'indexOf',
        BuiltinNames.arrayIndexOfFuncNames,
        false,
        [binaryen.anyref, null, binaryen.anyref],
        binaryen.f64,
    );
    addArrayMethod(
        module,
        'lastIndexOf',
        BuiltinNames.arrayLastIndexOfFuncNames,
        false,
        [binaryen.anyref, null, binaryen.anyref],
        binaryen.f64,
    );
    addArrayMethod(
        module,
        'every',
        BuiltinNames.arrayEveryFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.i32,
    );
    addArrayMethod(
        module,
        'some',
        BuiltinNames.arraySomeFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.i32,
    );
    addArrayMethod(
        module,
        'forEach',
        BuiltinNames.arrayForEachFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.none,
    );
    addArrayMethod(
        module,
        'map',
        BuiltinNames.arrayMapFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'filter',
        BuiltinNames.arrayFilterFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'reduce',
        BuiltinNames.arrayReduceFuncNames,
        false,
        [binaryen.anyref, binaryen.anyref, null],
        null,
    );
    addArrayMethod(
        module,
        'reduceRight',
        BuiltinNames.arrayReduceRightFuncNames,
        false,
        [binaryen.anyref, binaryen.anyref, null],
        null,
    );
    addArrayMethod(
        module,
        'find',
        BuiltinNames.arrayFindFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'findIndex',
        BuiltinNames.arrayFindIndexFuncNames,
        true,
        [binaryen.anyref, binaryen.anyref],
        binaryen.f64,
    );
    addArrayMethod(
        module,
        'fill',
        BuiltinNames.arrayFillFuncNames,
        false,
        [binaryen.anyref, null, binaryen.anyref, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'copyWithin',
        BuiltinNames.arrayCopyWithinFuncNames,
        true,
        [binaryen.anyref, binaryen.f64, binaryen.f64, binaryen.anyref],
        binaryen.anyref,
    );
    addArrayMethod(
        module,
        'includes',
        BuiltinNames.arrayIncludesFuncNames,
        false,
        [binaryen.anyref, null, binaryen.anyref],
        binaryen.i32,
    );
}

function addArrayMethod(
    module: binaryen.Module,
    method: string,
    nameMap: BuiltinNames.GenericFuncName,
    commonGenericApi: boolean,
    /* use null to represent generic type */
    paramTypes: (binaryen.Type | null)[],
    returnType: binaryen.Type | null,
) {
    const wasmTypeMap: any = {
        i32: binaryen.i32,
        i64: binaryen.i64,
        f32: binaryen.f32,
        f64: binaryen.f64,
        anyref: binaryen.anyref,
    };

    for (const [key, value] of Object.entries(nameMap)) {
        if (key === 'generic') {
            continue;
        }
        module.addFunctionImport(
            UtilFuncs.getFuncName(BuiltinNames.builtinModuleName, value),
            'env',
            commonGenericApi
                ? `array_${method}_generic`
                : `array_${method}_${key}`,
            binaryen.createType([
                emptyStructType.typeRef,
                ...paramTypes.map((p) => {
                    if (p === null) {
                        return wasmTypeMap[key];
                    }
                    return p;
                }),
            ]),
            returnType !== null ? returnType : wasmTypeMap[key],
        );
    }
}
