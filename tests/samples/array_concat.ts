/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_concat_number() {
    let array1: number[] = [1, 2];
    let length: number = array1.concat(3, 4).length;
    return length; // 4
}

export function array_concat_boolean() {
    let array1: boolean[] = [true, false];
    let length: number = array1.concat(true, false).length;
    return length; // 4
}

export function array_concat_string() {
    let array1: string[] = ['hello', 'world'];
    let length: number = array1.concat('hello', 'world').length;
    return length;  // 4
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_concat_class() {
    let array1: A[] = [new A(), new A()];
    let b : A = new B();
    let length: number = array1.concat(new A(), new A(), b).length;
    return length; // 5
}

interface I {
    x: string
}

export function array_concat_interface() {
    let array1: I[] = [{ x: '' }, { x: '' }];
    let obj = new B();
    let i : I = obj;
    let length = array1.concat(i).length;
    return length; // 3
}

export function array_concat_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5]];
    let length = array.concat([2, 5, 2], [44, 2]).length;
    return length;  // 4
}

export function array_concat_string_array() {
    let array: Array<Array<string>> = [['hello', 'wasm'], ['world']];
    console.log(array.concat(['123'])[0][0]); // hello
    return array.length;   // 2
}