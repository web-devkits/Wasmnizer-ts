/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

const size = 1e4;
const arr = new Array<number>(size);
const expect = 49999995000000;
let res = 0;

export function main() {
    for (let i = 0, j = 0; i < 1e7; i++, j++) {
        arr[j] = i;
        res += arr[j];
        if (j >= size - 1) j = 0;
    }
    if (res !== expect) {
        console.log('Validate result error in array access');
    }

    return res;
}
