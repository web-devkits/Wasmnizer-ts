/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_shift_number() {
    let array: number[] = [1, 2, 4];
    let x = array.shift();
    return array.length;  // 2
}

export function array_shift_boolean() {
    let array: boolean[] = [true, false, false];
    let b = array.shift();
    return array.length; // 2
}

export function array_shift_string() {
    let array: string[] = ['hello', 'world'];
    let s = array.shift();
    return array.length; // 1
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_shift_class() {
    let array: A[] = [new A(), new A()];
    let o = array.shift();
    return array.length; // 1
}

interface I {
    x: string
}

export function array_shift_interface() {
    let array: I[] = [{ x: '' }, { x: '' }];
    let i = array.shift();
    return array.length; // 1
}

export function array_shift_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let a = array.shift();          // [1, 2, 3]
    console.log(a[0]);              // 1
    return array.length + a.length; // 6 (3 + 3)
}

export function array_shift_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world'], ['123']];
    console.log(array.shift()[0]);   // h
    return array.length;             // 2
}