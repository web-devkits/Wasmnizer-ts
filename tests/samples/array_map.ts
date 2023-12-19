/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_map_number() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.map((val, idx, arr) => {
        return val + 100;
    })
    return arr2[0]; // 223
}

export function array_map_boolean() {
    let array1: boolean[] = [true, false, true, true];
    let arr2 = array1.map((val, idx, arr) => {
        return [val, val, !val]
    })
    return arr2[1].length; // 3
}

export function array_map_string() {
    let array1: string[] = ['hello', 'world', 'hello', 'world'];
    let arr2 = array1.map((val, idx, arr) => {
        return val + '!';
    })
    console.log(arr2[0]);
    return arr2[0].length; // 6
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_map_class() {
    let b : A = new B();
    b.x = 'hello';
    let array1: A[] = [new A(), new A(), new A(), new A(), b];
    let arr2 = array1.map((val, idx, arr) => {
        return val.x + '!';
    })
    console.log(arr2[1]);   // xxx!
    console.log(arr2[4]);   // hello!
    return arr2[4].length; // 6
}

interface I {
    x: string
}

export function array_map_interface() {
    let obj = new B();
    let i : I = obj;
    let array1: I[] = [{ x: '' }, { x: '' }, i];
    let arr2 = array1.map((val, idx, arr) => {
        return {
            x: val.x + '!',
            y: val.x + '!!',
            z: idx
        };
    })
    console.log(arr2[0].x); // !
    console.log(arr2[2].y); // xxx!!
    return arr2.length; // 3
}

export function array_map_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let arr2 = array.map((val, idx, arr) => {
        val.pop();
        return val;
    })
    return arr2[2].length; // 2
}

export function array_map_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world'], ['123']];
    let arr2 = array.map((val, idx, arr) => {
        return val[0] + '^';
    })
    console.log(arr2[1]);   // world^
    return arr2.length; // 3
}

export function array_map_func() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.map((val, idx, arr) => {
        return (x: number) => { return x + val };
    })
    return arr2[4](1); // 454
}
