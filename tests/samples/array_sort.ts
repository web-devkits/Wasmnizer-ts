/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_sort_number() {
    let arr: Array<number> = [12, 23, 6, 4, 45, 0, 56];
    let ret = arr.sort((a, b) => a - b);
    arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
    ret.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });

}