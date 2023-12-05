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
import { builtinTypes } from '../../src/semantics/builtin.js';
import {
    Export,
    Import,
    NativeSignature as NativeSignatureFrontEnd,
    getBuiltinType,
    isExportComment,
    isImportComment,
    isNativeSignatureComment,
    parseComment,
} from '../../src/utils.js';
import { FunctionalFuncs } from '../../src/backend/binaryen/utils.js';
import binaryen from 'binaryen';
import { arrayBufferTypeInfo } from '../../src/backend/binaryen/glue/packType.js';

describe('testParseNativeSignature', function () {
    it('ARRAYBUFFER_TO_I32', function () {
        const func = new FunctionDeclareNode(
            'funcA',
            FunctionOwnKind.DEFAULT,
            new FunctionType(-1, WASM.I32, [
                builtinTypes.get('ArrayBuffer')!,
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
        FunctionalFuncs.parseNativeSignature(
            module,
            innerOpStmts,
            func.funcType.argumentsType,
            [arrayBufferTypeInfo.typeRef, binaryen.i32],
            signatureComment.paramTypes,
            2,
            calledParamValueRefs,
            vars,
            true,
        );

        expect(calledParamValueRefs.length).eq(2);
        expect(vars.length).eq(1);
        expect(vars[0]).eq(binaryen.i32);
    });
    it('I32_TO_ARRAYBUFFER', function () {
        const func = new FunctionDeclareNode(
            'funcA',
            FunctionOwnKind.DEFAULT,
            new FunctionType(-1, WASM.I32, [
                builtinTypes.get('ArrayBuffer')!,
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
        FunctionalFuncs.parseNativeSignature(
            module,
            innerOpStmts,
            signatureComment.paramTypes,
            [binaryen.i32, binaryen.i32],
            func.funcType.argumentsType,
            2,
            calledParamValueRefs,
            vars,
            false,
        );

        expect(calledParamValueRefs.length).eq(2);
        expect(vars.length).eq(2);
        expect(vars[0]).eq(arrayBufferTypeInfo.typeRef);
        expect(vars[1]).eq(binaryen.i32);
    });
});

describe('testParseComment', function () {
    it('parseNativeSignature', function () {
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
    });
    it('parseImport', function () {
        const commentStr = '// Wasmnizer-ts: @Import@ wamr, nameH';
        const res = parseComment(commentStr);
        const isImport = isImportComment(res);
        const moduleName = (res as Import).moduleName;
        const funcName = (res as Import).funcName;

        expect(isImport).eq(true);
        expect(moduleName).eq('wamr');
        expect(funcName).eq('nameH');
    });
    it('parseExport', function () {
        const commentStr = '// Wasmnizer-ts: @Export@ nameD';
        const res = parseComment(commentStr);
        const isExport = isExportComment(res);
        const exportName = (res as Export).exportName;

        expect(isExport).eq(true);
        expect(exportName).eq('nameD');
    });
});
