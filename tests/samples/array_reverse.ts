/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_reverse_number() {
    let array: number[] = [1, 2, 4];
    let x = array.reverse();
    return array.length;             // 3
}

export function array_reverse_boolean() {
    let array: boolean[] = [true, false, false];
    let b = array.reverse();
    return array.length;             // 3
}

export function array_reverse_string() {
    let array: string[] = ['hello', 'world'];
    let s = array.reverse();
    return array.length;             // 2
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_reverse_class() {
    let array: A[] = [new A(), new A()];
    let o = array.reverse();
    return array.length;              // 2
}

interface I {
    x: string
}

export function array_reverse_interface() {
    let array: I[] = [{ x: '' }, { x: '' }];
    let i = array.reverse();
    return array.length;              // 2
}

export function array_reverse_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let a = array.reverse();
    console.log(a[0][0]);              // 44
    return array.length + a.length;    // 8 (4 + 4)
}

export function array_reverse_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world'], ['123']];
    console.log(array.reverse()[0][0]); // 123
    return array.length;                // 3
}