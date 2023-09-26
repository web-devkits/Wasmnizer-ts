/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_indexOf_number() {
    let array: number[] = [1, 2, 3, 4, 5, 6];
    let index: number = array.indexOf(4, 0);
    return index; // 3
}

export function array_indexOf_boolean() {
    let array: boolean[] = [true, false];
    let index: number = array.indexOf(false, 0);
    return index; // 1
}

export function array_indexOf_string() {
    let array1: string[] = ['hello', 'world', "hello", "wasm"];
    let index: number = array1.indexOf("wasm", 1);
    return index;  // 3
}

class A {
    a: string = 'hello'
}

export function array_indexOf_class() {
    let a1 = new A();
    let a2 = new A();
    let array1: A[] = [a1, a2];
    let index: number = array1.indexOf(a2, 0);
    return index; // 1
}