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
function output_number_arr(arr: number[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
function output_string_arr(arr: string[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
function output_boolean_arr(arr: boolean[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
function output_interface_arr(arr: I[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i].x);
    }
}
function output_class_arr(arr: A[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i].x);
    }
}
export function array_copyWithin_number() {
    /* 0 < target < len */
    let arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, 5);
    //output_number_arr(arr);         // 4 5 3 4 5 6

    /* -len < target < 0 */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(-5, 3, 5);
    //output_number_arr(arr);         // 1 4 5 4 5 6

    /* target < -len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(-20, 3, 5);
    //output_number_arr(arr);         // 4 5 3 4 5 6

    /* target >= len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(6, 3, 5);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(20, 3, 5);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    /*-len < start < 0*/
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, -3, 5);
    //output_number_arr(arr);         // 4 5 3 4 5 6

    /* start < -len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(1, -30, 5);
    //output_number_arr(arr);         // 1 1 2 3 4 5

    /* start >= len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(1, 6, 5);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(1, 20, 5);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    /* -len < end < 0 */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, -1);
    //output_number_arr(arr);         // 4 5 3 4 5 6

    /* end < -len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, -10);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    /* end >= len */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, 10);
    //output_number_arr(arr);         // 4 5 6 4 5 6

    /* 0 < end <= start */
    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, 2);
    //output_number_arr(arr);         // 1 2 3 4 5 6

    arr = [1, 2, 3, 4, 5, 6];
    arr.copyWithin(0, 3, 3);
    //output_number_arr(arr);         // 1 2 3 4 5 6
    return arr.length;
}

export function array_copyWithin_string() {
    let arr = ["1", "2", "3", "4", "5"];
    arr.copyWithin(0, 1, 3);
    output_string_arr(arr);         // 2 3 3 4 5
}

export function array_copyWithin_boolean() {
    let arr = [true, false, true];
    arr.copyWithin(0, 1, 2);
    output_boolean_arr(arr);        // false false true
}

export function array_copyWithin_class() {
    let arr: A[] = [new A("A1"), new A("A2"), new A("A3")];
    arr.copyWithin(0, 1, 2);
    output_class_arr(arr);          // A2 A2 A3
}

export function array_copyWithin_interface() {
    let arr: I[] = [{ x: 'A1' }, { x: 'A2' }, { x: 'A3' }];
    arr.copyWithin(0, 1, 2);
    output_interface_arr(arr);      // A2 A2 A3
}