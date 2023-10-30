/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_slice() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let ret = arr.slice(5, 10); // [0, 456]
    ret.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
}

export function array_slice_empty() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let ret = arr.slice(5, 5); // empty
    ret.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
}

export function array_slice_endIdxisUndefined() {
    let arr: Array<string> = ['a', 'b', 'c']
    let ret = arr.slice(0);
    ret.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
}

export function array_set_length() {
    let arr: Array<string> = ['a', 'b', 'c']
    arr.length = 0;
    arr.push('d','e','f','g')
    for(const a of arr)
        console.log(a)
}