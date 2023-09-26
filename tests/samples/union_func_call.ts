/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function testFunc(a: boolean) {
    if (a) {
        return 10;
    }
    return 11;
}

export function unionFuncCall() {
    let fn: undefined | ((a: boolean)=> number) = testFunc;
    const a = fn(true);
    console.log(a);
}
