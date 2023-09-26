/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function booleanBasicTrue(): boolean {
    const i1 = true;
    return i1;
}

export function booleanBasicFalse(): boolean {
    const i1 = false;
    return i1;
}

export function booleanCmp() {
    const f1 = false;
    console.log(f1 !== false); // false
    console.log(f1 === false); // true
}
