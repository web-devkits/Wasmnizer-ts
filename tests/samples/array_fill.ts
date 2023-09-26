/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_fill_number() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let ret = arr.fill(0, 2, 10);

    arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
    ret.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
}

export function array_fill_string() {
    let arr: Array<string> = ["s123", "s234", "s456",
        "s4", "s453", "s0", "s456"];
    let filled_arr: Array<string> = arr.fill("hello", -10, 10);
    arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    })
    filled_arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    })
}