/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_lastIndexOf_number() {
    let array: number[] = [1, 2, 3, 4, 5, 6];
    let lastindex: number = array.lastIndexOf(4, 0);
    return lastindex; // 3
}

export function array_lastIndexOf_boolean() {
    let array: boolean[] = [true, false];
    let lastindex: number = array.lastIndexOf(false, 0);
    return lastindex; // 1
}

export function array_lastIndexOf_string() {
    let array: string[] = ['wasm', 'hello', 'world', "wasm", "array"];
    let lastindex: number = array.lastIndexOf("wasm", -2);
    return lastindex;  // 3
}

class A {
    a: string = 'hello'
}

export function array_lastIndexOf_class() {
    let a1 = new A();
    let a2 = new A();
    let a3 = new A();
    let array1: A[] = [a1, a2, a3];
    let index: number = array1.lastIndexOf(a3, 0);
    return index; // 2
}