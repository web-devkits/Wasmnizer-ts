/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

const size = 1e6;
let val: any = 0;
let res = 0;
const expect = 499998500001;

export function main() {
    for (let i = 0; i < size; i++) {
        res += val;
        val = i;
    }
    if (res !== expect) {
        console.log('Validate result error in any type access (basic type)');
    }
    return res;
}
