/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_unshift_number() {
    let array: number[] = [3, 4];
    let length: number = array.unshift(1, 2);
    return length; // 4
}

export function array_unshift_boolean() {
    let array: boolean[] = [true, false];
    let length: number = array.unshift(true, false);
    return length; // 4
}

export function array_unshift_string() {
    let array: string[] = ['hello', 'world'];
    let length: number = array.unshift('hi', 'level');
    return length; // 4
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_unshift_class() {
    let array: A[] = [new A(), new A()];
    let b : A = new B();
    let length: number = array.unshift(new A(), new A(), b);
    return length; // 5
}

interface I {
    x: string
}

export function array_unshift_interface() {
    let array: I[] = [{ x: '' }, { x: '' }];
    let obj = new B();
    let i : I = obj;
    let length = array.unshift(i);
    return length; // 3
}

export function array_unshift_number_array() {
    let array: Array<Array<number>> = [[3, 4, 5], [4, 5, 6]];
    let length = array.unshift([0, 1, 2], [1, 2, 3]);
    return length;            // 4
}

export function array_unshift_string_array() {
    let array: Array<Array<string>> = [['wasm', 'hello'], ['world']];
    let length = array.unshift(['hi']);
    console.log(array[1][0]); // wasm
    return length;            // 3
}