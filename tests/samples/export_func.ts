/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export { mulFunc };
export { subFunc as sub, divFunc as divFunc };
export default defaultFunc;

function defaultFunc(): number {
    return 100;
}

export function addFunc(a: number, b: number) {
    return a + b;
}

function subFunc(a: number, b: number) {
    return a - b;
}

function mulFunc(a: number, b: number) {
    return a * b;
}

function divFunc(a: number, b: number) {
    return a / b;
}
