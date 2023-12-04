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
import { Import } from '../../src/utils.js';
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
