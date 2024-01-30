/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import 'mocha';
import { expect } from 'chai';
import {
    BlockNode,
    FunctionDeclareNode,
    FunctionOwnKind,
    NativeSignature,
} from '../../src/semantics/semantics_nodes.js';
import { FunctionType, WASM } from '../../src/semantics/value_types.js';
import {
    GetBuiltinObjectType,
    builtinTypes,
} from '../../src/semantics/builtin.js';
import {
    Export,
    Import,
    MutabilityKind,
    NativeSignature as NativeSignatureFrontEnd,
    NullabilityKind,
    PackedTypeKind,
    WASMArray,
    WASMStruct,
    getBuiltinType,
    isExportComment,
    isImportComment,
    isNativeSignatureComment,
    isWASMArrayComment,
    isWASMStructComment,
    parseComment,
} from '../../src/utils.js';
import { FunctionalFuncs } from '../../src/backend/binaryen/utils.js';
import binaryen from 'binaryen';
import { arrayBufferTypeInfo } from '../../src/backend/binaryen/glue/packType.js';
import exp from 'constants';

describe('testParseNativeSignature', function () {
    it('ARRAYBUFFER_TO_I32', function () {
        const func = new FunctionDeclareNode(
            'funcA',
            FunctionOwnKind.DEFAULT,
            new FunctionType(-1, WASM.I32, [
                GetBuiltinObjectType('ArrayBuffer'),
                WASM.I32,
            ]),
            new BlockNode([]),
        );
        const signatureComment: NativeSignature = {
            paramTypes: [WASM.I32, WASM.I32],
            returnType: WASM.I32,
        };
        func.comments.push(signatureComment);
        const module = new binaryen.Module();
        const innerOpStmts: binaryen.ExpressionRef[] = [];
        const calledParamValueRefs: binaryen.ExpressionRef[] = [];
        const vars: binaryen.ExpressionRef[] = [];
        const mallocOffsets: binaryen.ExpressionRef[] = [];
        FunctionalFuncs.parseNativeSignature(
            module,
            innerOpStmts,
            func.funcType.argumentsType,
            [arrayBufferTypeInfo.typeRef, binaryen.i32],
            signatureComment.paramTypes,
            2,
            calledParamValueRefs,
            vars,
            mallocOffsets,
            true,
        );

        expect(calledParamValueRefs.length).eq(2);
        expect(vars.length).eq(2);
        expect(vars[0]).eq(binaryen.i32);
        expect(vars[1]).eq(binaryen.i32);
    });
    it('I32_TO_ARRAYBUFFER', function () {
        const func = new FunctionDeclareNode(
            'funcA',
            FunctionOwnKind.DEFAULT,
            new FunctionType(-1, WASM.I32, [
                GetBuiltinObjectType('ArrayBuffer'),
                WASM.I32,
            ]),
            new BlockNode([]),
        );
        const signatureComment: NativeSignature = {
            paramTypes: [WASM.I32, WASM.I32],
            returnType: WASM.I32,
        };
        func.comments.push(signatureComment);
        const module = new binaryen.Module();
        const innerOpStmts: binaryen.ExpressionRef[] = [];
        const calledParamValueRefs: binaryen.ExpressionRef[] = [];
        const vars: binaryen.ExpressionRef[] = [];
        const mallocOffsets: binaryen.ExpressionRef[] = [];
        FunctionalFuncs.parseNativeSignature(
            module,
            innerOpStmts,
            signatureComment.paramTypes,
            [binaryen.i32, binaryen.i32],
            func.funcType.argumentsType,
            2,
            calledParamValueRefs,
            vars,
            mallocOffsets,
            false,
        );

        expect(calledParamValueRefs.length).eq(2);
        expect(vars.length).eq(2);
        expect(vars[0]).eq(arrayBufferTypeInfo.typeRef);
        expect(vars[1]).eq(binaryen.i32);
    });
});

describe('testParseComment', function () {
    it('parseNativeSignatureTrue', function () {
        const commentStr = '// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>i32';
        const res = parseComment(commentStr);
        const isNativeSignature = isNativeSignatureComment(res);
        const paramTypes = (res as NativeSignatureFrontEnd).paramTypes;
        const returnType = (res as NativeSignatureFrontEnd).returnType;

        expect(isNativeSignature).eq(true);
        expect(paramTypes.length).eq(2);
        expect(paramTypes[0]).eq(getBuiltinType('i32'));
        expect(paramTypes[1]).eq(getBuiltinType('i32'));
        expect(returnType).eq(getBuiltinType('i32'));

        const commentStr2 =
            '// Wasmnizer-ts: @NativeSignature@ (anyref, f64)=>number';
        const res2 = parseComment(commentStr2);
        const isNativeSignature2 = isNativeSignatureComment(res2);
        const paramTypes2 = (res2 as NativeSignatureFrontEnd).paramTypes;
        const returnType2 = (res2 as NativeSignatureFrontEnd).returnType;

        expect(isNativeSignature2).eq(true);
        expect(paramTypes2.length).eq(2);
        expect(paramTypes2[0]).eq(getBuiltinType('anyref'));
        expect(paramTypes2[1]).eq(getBuiltinType('f64'));
        expect(returnType2).eq(getBuiltinType('number'));
    });
    it('parseNativeSignatureTrueWithMultiTab', function () {
        const commentStr =
            '// Wasmnizer-ts:     @NativeSignature@            (i32 , i32   )=> i32';
        const res = parseComment(commentStr);
        const isNativeSignature = isNativeSignatureComment(res);
        const paramTypes = (res as NativeSignatureFrontEnd).paramTypes;
        const returnType = (res as NativeSignatureFrontEnd).returnType;

        expect(isNativeSignature).eq(true);
        expect(paramTypes.length).eq(2);
        expect(paramTypes[0]).eq(getBuiltinType('i32'));
        expect(paramTypes[1]).eq(getBuiltinType('i32'));
        expect(returnType).eq(getBuiltinType('i32'));
    });
    it('parseNativeSignatureFalseWithWrongSpecificStr', function () {
        const commentStr = '//Wasmnizer-js: @NativeSignature@ (i32, i32)=>i32';
        const res = parseComment(commentStr);
        expect(res).eq(null);

        const commentStr2 = '//Wasmnizer-ts: @NativeSignature (i32, i32)=>i32';
        const res2 = parseComment(commentStr2);
        expect(res2).eq(null);

        const commentStr3 = '//Wasmnizer-ts: @NativeSignature@ (i32, i32)=i32';
        const res3 = parseComment(commentStr3);
        expect(res3).eq(null);
    });
    it('parseNativeSignatureFalseWithInValidType', function () {
        const commentStr =
            '//Wasmnizer-ts: @NativeSignature@ (ArrayBuffer)=>i32';
        const res = parseComment(commentStr);
        expect(res).eq(null);

        const commentStr2 =
            '//Wasmnizer-ts: @NativeSignature (i32)=>ArrayBuffer';
        const res2 = parseComment(commentStr2);
        expect(res2).eq(null);
    });
    it('parseImportTrue', function () {
        const commentStr = '// Wasmnizer-ts: @Import@ wamr, nameH';
        const res = parseComment(commentStr);
        const isImport = isImportComment(res);
        const moduleName = (res as Import).moduleName;
        const funcName = (res as Import).funcName;

        expect(isImport).eq(true);
        expect(moduleName).eq('wamr');
        expect(funcName).eq('nameH');
    });
    it('parseImportFalse', function () {
        const commentStr = '// Wasmnizer-ts: @Impor@ wamr, nameH';
        const res = parseComment(commentStr);
        expect(res).eq(null);

        const commentStr2 = '// Wasmnizer-ts: @Import@ wamr';
        const res2 = parseComment(commentStr2);
        expect(res2).eq(null);

        const commentStr3 = '// Wasmnizer-ts: @Import@ wamr, n, q';
        const res3 = parseComment(commentStr3);
        expect(res3).eq(null);
    });
    it('parseExportTrue', function () {
        const commentStr = '// Wasmnizer-ts: @Export@ nameD';
        const res = parseComment(commentStr);
        const isExport = isExportComment(res);
        const exportName = (res as Export).exportName;

        expect(isExport).eq(true);
        expect(exportName).eq('nameD');
    });
    it('parseExportFalse', function () {
        const commentStr = '// Wasmnizer-ts: @Export@ nameD, nameE';
        const res = parseComment(commentStr);

        expect(res).eq(null);
    });
    it('parseWASMArraySimpleInfo', function () {
        const commentStr = '// Wasmnizer-ts: @WASMArray@';
        const res = parseComment(commentStr);
        const isWASMArray = isWASMArrayComment(res);
        const packedTypeKind = (res as WASMArray).packedType;
        const mutability = (res as WASMArray).mutability;
        const nullability = (res as WASMArray).nullability;

        expect(isWASMArray).eq(true);
        expect(packedTypeKind).eq(PackedTypeKind.Not_Packed);
        expect(mutability).eq(MutabilityKind.Mutable);
        expect(nullability).eq(NullabilityKind.Nullable);
    });
    it('parseWASMArrayFullInfo', function () {
        const commentStr =
            '// Wasmnizer-ts: @WASMArray@ <Not_Packed, Mutable, Nullable>';
        const res = parseComment(commentStr);
        const isWASMArray = isWASMArrayComment(res);
        const packedTypeKind = (res as WASMArray).packedType;
        const mutability = (res as WASMArray).mutability;
        const nullability = (res as WASMArray).nullability;

        expect(isWASMArray).eq(true);
        expect(packedTypeKind).eq(PackedTypeKind.Not_Packed);
        expect(mutability).eq(MutabilityKind.Mutable);
        expect(nullability).eq(NullabilityKind.Nullable);
    });
    it('parseWASMStructSimpleInfo', function () {
        const commentStr = '// Wasmnizer-ts: @WASMStruct@ ';
        const res = parseComment(commentStr);
        const isWASMStruct = isWASMStructComment(res);

        expect(isWASMStruct).eq(true);
    });
    it('parseWASMStructFullInfo', function () {
        const commentStr =
            '// Wasmnizer-ts: @WASMStruct@   <[I8, I16], [Mutable, Immutable], NonNullable, NULL>';
        const res = parseComment(commentStr);
        const isWASMStruct = isWASMStructComment(res);
        const packedTypeKinds = (res as WASMStruct).packedTypes!;
        const mutabilitys = (res as WASMStruct).mutabilitys!;
        const nullability = (res as WASMStruct).nullability!;
        const baseTypeName = (res as WASMStruct).baseTypeName!;

        expect(isWASMStruct).eq(true);
        expect(packedTypeKinds.length).eq(2);
        expect(packedTypeKinds[0]).eq(PackedTypeKind.I8);
        expect(packedTypeKinds[1]).eq(PackedTypeKind.I16);
        expect(mutabilitys.length).eq(2);
        expect(mutabilitys[0]).eq(MutabilityKind.Mutable);
        expect(mutabilitys[1]).eq(MutabilityKind.Immutable);
        expect(nullability).eq(NullabilityKind.NonNullable);
        expect(baseTypeName).eq('NULL');
    });
});
