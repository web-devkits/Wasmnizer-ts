/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function arrayLength() {
    const a1: i32 = 10;
    const arr1_i32: i32[] = new Array(a1);
    const arr1_default = new Array(a1);  // default is any type
    arr1_i32[0] = 32;
    arr1_default[0] = 30;
    console.log(arr1_i32[0]);
    console.log(arr1_default[0]);

    const a2: i64 = 20;
    const arr2_i64: i64[] = new Array(a2);
    const arr2_default = new Array(a2);  // default is any type
    arr2_i64[0] = 64;
    arr2_default[0] = 60;
    console.log(arr2_i64[0]);
    console.log(arr2_default[0]);

    const a3: f32 = 30;
    const arr3_f32: f32[] = new Array(a3);
    const arr3_default = new Array(a3);  // default is any type
    arr3_f32[0] = 32.00;
    arr3_default[0] = 30.30;
    console.log(arr3_f32[0]);
    console.log(arr3_default[0]);

    const a4: f64 = 40;
    const arr4_f64: f64[] = new Array(a4);
    const arr4_default = new Array(a4);  // default is any type
    arr4_f64[0] = 64.64;
    arr4_default[0] = 60.60;
    console.log(arr4_f64[0]);
    console.log(arr4_default[0]);
}