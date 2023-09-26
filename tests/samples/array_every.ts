/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
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
export function array_every_string() {
    let words = ['spray', 'limit', 'elite', 'exuberant', 'destruction', 'present'];
    let result = words.every((word, idx, arr) => word.length > 6);
    console.log(result);                        // false

    words = ['exuberant', 'destruction', 'present'];
    result = words.every((word, idx, arr) => word.length > 6);
    console.log(result);                        // true
}

export function array_every_number() {
    let arr = [1, 2, 3, 4, 5, 6];
    let result = arr.every((num, idx, arr) => num > 3);
    console.log(result);                        // false

    arr = [4, 5, 6];
    result = arr.every((num, idx, arr) => num > 3);
    console.log(result);                        // true
}

export function array_every_boolean() {
    let arr = [true, false];
    let result = arr.every((e, idx, arr) => e);
    console.log(result);                        // false

    arr = [true];
    result = arr.every((e, idx, arr) => e);
    console.log(result);                        // true

}

export function array_every_class() {
    let arr: A[] = [new A("1"), new A("12"), new A("123"), new A("1234")];
    let result = arr.every((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // false

    arr = [new A("123"), new A("1234")];
    result = arr.every((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // true
}

export function array_every_interface() {
    let arr: I[] = [{ x: 'A1' }, { x: 'A2' }, { x: 'A3' }];
    let result = arr.every((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // false

    let arr2: I[] = [{ x: 'A11' }, { x: 'A22' }, { x: 'A33' }];
    result = arr2.every((obj, idx, arr) => obj.x.length > 2);
    console.log(result);                        // true
}