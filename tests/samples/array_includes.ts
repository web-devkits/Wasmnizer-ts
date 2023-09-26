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
export function array_includes_number() {
    let arr = [1, 2, 3, 4, 5];
    console.log(arr.includes(2, 10));           // false
    console.log(arr.includes(2, 2));            // false
    console.log(arr.includes(2, 3));            // false
    console.log(arr.includes(10, undefined));   // false
    console.log(arr.includes(10, 3.1));         // false
    console.log(arr.includes(2, -10));          // true
    console.log(arr.includes(2, 1));            // true
    console.log(arr.includes(2, undefined));    // true
    console.log(arr.includes(5, 3.1));          // true
}

export function array_includes_string() {
    let arr = ["1", "2", "3", "4", "5", "6"];
    console.log(arr.includes("21", 0));             // false
    console.log(arr.includes("1", 2.1));            // false
    console.log(arr.includes("1", undefined));      // true
    console.log(arr.includes("1", 0));              // true

    let arr2 = ["a", "b", "c"];
    console.log(arr2.includes("a", -2));    // false
}

export function array_includes_boolean() {
    let arr = [true, false];
    console.log(arr.includes(false, 20));           // false;
    console.log(arr.includes(false, undefined));    // true;
    console.log(arr.includes(false, 0.5));          // true;
}

export function array_includes_class() {
    let A1 = new A("1");
    let A2 = new A("2");
    let A3 = new A("3");
    let A4 = new A("4");
    let A5 = new A("5");
    let arr: A[] = [A1, A2, A3, A4];
    console.log(arr.includes(A1, 20));          // false
    console.log(arr.includes(A5, 0));           // false
    console.log(arr.includes(A1, 0.5));         // true
    console.log(arr.includes(A1, undefined));   // true
}

export function array_includes_interface() {
    let A1: I = { x: 'A1' };
    let A2: I = { x: 'A2' };
    let A3: I = { x: 'A3' };
    let arr: I[] = [A1, A2];
    console.log(arr.includes(A1, 20));          // false
     console.log(arr.includes(A3, 0));          // false
    console.log(arr.includes(A1, 0.5));         // true
    console.log(arr.includes(A1, undefined));   // true
}