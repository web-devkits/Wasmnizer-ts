/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x: string = 'xxx'
    constructor(x: string) {
        this.x = x;
    }
}

interface I {
    x: string
}
export function array_some_string() {
    let words = ['spray', 'limit', 'elite'];
    let result = words.some((word, idx, arr) => word.length > 6);
    console.log(result);                        // false

    words = ['spray', 'limit', 'elite', 'exuberant', 'destruction', 'present'];
    result = words.some((word, idx, arr) => word.length > 6);
    console.log(result);                        // true
}

export function array_some_number() {
    let arr = [1, 2, 3];
    let result = arr.some((num, idx, arr) => num > 3);
    console.log(result);                        // false

    arr = [1, 2, 3, 4, 5, 6];
    result = arr.some((num, idx, arr) => num > 3);
    console.log(result);                        // true
}

export function array_some_boolean() {
    let arr = [false];
    let result = arr.some((e, idx, arr) => e);
    console.log(result);                        // false

    arr = [true, false];
    result = arr.some((e, idx, arr) => e);
    console.log(result);                        // true

}

export function array_some_class() {
    let arr: A[] = [new A("1"), new A("12")];
    let result = arr.some((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // false

    arr = [new A("1"), new A("12"), new A("123"), new A("1234")];
    result = arr.some((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // true
}

export function array_some_interface() {
    let arr: I[] = [{ x: 'A1' }, { x: 'A2' }, { x: 'A3' }];
    let result = arr.some((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // false

    let arr2: I[] = [{ x: 'A1' }, { x: 'A2' }, { x: 'A33' }];
    result = arr2.some((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // true
}
