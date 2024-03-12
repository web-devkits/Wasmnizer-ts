/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

type i32 = number;

export function main() {
    const size: i32 = 1e4;
    const arr = new Array<number>(1e4);
    const expect = 49999995000000;
    let res = 0;
    for (let i = 0, j: i32 = 0; i < 1e7; i++, j++) {
        arr[j] = i;
        res += arr[j];
        if (j >= size - 1) j = 0;
    }
    if (res !== expect) {
        console.log('Validate result error in array access (i32 index)');
    }

    return res;
}
