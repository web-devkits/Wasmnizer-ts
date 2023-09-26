/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_pop_number() {
    let array1: number[] = [1, 2, 4];
    let x = array1.pop();
    return array1.length;  // 2
}

export function array_pop_boolean() {
    let array1: boolean[] = [true, false, false];
    let b = array1.pop();
    return array1.length; // 2
}

export function array_pop_string() {
    let array1: string[] = ['hello', 'world'];
    let s = array1.pop();
    return array1.length; // 1
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_pop_class() {
    let array1: A[] = [new A(), new A()];
    let o = array1.pop();
    return array1.length; // 1
}

interface I {
    x: string
}

export function array_pop_interface() {
    let array1: I[] = [{ x: '' }, { x: '' }];
    let i = array1.pop();
    return array1.length; // 1
}

export function array_pop_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let a = array.pop();
    return array.length + a.length; // 5 (3 + 2)
}

export function array_pop_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world'], ['123']];
    console.log(array.pop()[0]);
    return array.length; // 2
}
