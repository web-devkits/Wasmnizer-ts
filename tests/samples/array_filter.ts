/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_filter_number() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.filter((val, idx, arr) => {
        return val > 200;
    })
    return arr2.length; // 4
}

export function array_filter_boolean() {
    let array1: boolean[] = [true, false, true, true];
    let arr2 = array1.filter((val, idx, arr) => {
        return val;
    })
    return arr2.length; // 3
}

export function array_filter_string() {
    let array1: string[] = ['hello', 'world', 'hello', 'world'];
    let arr2 = array1.filter((val, idx, arr) => {
        return idx > 1;
    })
    return arr2.length; // 2
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_filter_class() {
    let b : A = new B();
    b.x = 'hello';
    let array1: A[] = [new A(), new A(), new A(), new A(), b];
    let arr2 = array1.filter((val, idx, arr) => {
        return val.x === 'hello';
    })
    return arr2.length; // 1
}

interface I {
    x: string
}

export function array_filter_interface() {
    let obj = new B();
    let i : I = obj;
    let array1: I[] = [{ x: '' }, { x: '' }, i];
    let arr2 = array1.filter((val, idx, arr) => {
        return val.x === '';
    })
    return arr2.length; // 2
}

export function array_filter_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let arr2 = array.filter((val, idx, arr) => {
        return val.length > 2;
    })
    return arr2.length; // 3
}

export function array_filter_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world'], ['123']];
    let arr2 = array.filter((val, idx, arr) => {
        return val[0] === 'h';
    })
    console.log(arr2[0][0]);
    return arr2.length;
}

export function push_in_callback() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.filter((val, idx, arr) => {
        arr.push(300);
        return val > 200;
    })
    return arr2.length; // 4
}

export function modify_in_callback() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.filter((val, idx, array) => {
        let index = idx + 1;
        if (index < array.length) {
            array[index] = 0;
        }
        return val > 200;
    })
    return arr2.length; // 0
}

export function nested_filter() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5], [2, 5, 2], [44, 2]];
    let arr2 = array.filter((val, idx, arr) => {
        let a = val.filter((val, idx, arr) => {
            return val > 5;
        })
        return a.length > 0;
    })
    return arr2.length; // 1
}

export function callback_use_closure_var() {
    let threshold = 200;
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    let arr2 = arr.filter((val, idx, arr) => {
        return val > threshold;
    })
    return arr2.length; // 4
}
