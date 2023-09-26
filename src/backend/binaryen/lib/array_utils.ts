/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from '../glue/binaryen.js';

export function array_get_length_i32(
    module: binaryen.Module,
    arr: binaryen.ExpressionRef,
) {
    return binaryenCAPI._BinaryenStructGet(
        module.ptr,
        1,
        arr,
        binaryen.getExpressionType(arr),
        false,
    );
}

export function array_get_data(
    module: binaryen.Module,
    arr: binaryen.ExpressionRef,
) {
    return binaryenCAPI._BinaryenStructGet(
        module.ptr,
        0,
        arr,
        binaryen.getExpressionType(arr),
        false,
    );
}
