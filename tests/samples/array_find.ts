/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_find_number() {
    let array: number[] = [100, 200, 300, 400];
    let element1 = array.find((val, idx, arr) => {
        return val > 200;
    })
    console.log(element1); // 300
    let element2 = array.find((val, idx, arr) => {
        return val > 500;
    })
    console.log(element2); // undefined
}

export function array_find_boolean() {
    let array: boolean[] = [true, false, true, true];
    let element = array.find((val, idx, arr) => {
        return val;
    })
    console.log(element); // true
}

export function array_find_string() {
    let array: string[] = ['hello', 'wasm', 'hello', 'awesome'];
    let element = array.find((val, idx, arr) => {
        return idx > 1;
    })
    console.log(element);  // hello
}

export function array_find_obj() {
    let array = [{a: 1, b: false}, {a: 2, b: false}, {a: 3, b: true}];
    let element = array.find((val, idx, arr) => {
        return val.a == 3;
    })!;
    console.log(element.b); // true
}