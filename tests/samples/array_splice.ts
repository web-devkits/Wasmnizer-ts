/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function output_number_arr(arr: number[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
function output_arr_boolean(arr: boolean[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
function output_arr_string(arr: string[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i]);
    }
}
class A {
    x: string = 'xxx'
    constructor(x: string) {
        this.x = x;
    }
}
function output_arr_class(arr: A[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i].x);
    }
}
interface I {
    x: string
}
function output_arr_interface(arr: I[]) {
    for (let i = 0; i < arr.length; ++i) {
        console.log(arr[i].x);
    }
}

export function array_splice_number() {
    /** the value of start:[0,len-1]
     *  the value of deleteCount > 0
     */
    let arr: Array<number> = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    let removed = arr.splice(5.5, 2.5, 1.5, 2.5, 3.5); // decimal
    //console.log("case1");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 1.5 2.5 3.5 8 9 10
    //output_number_arr(removed);                      // 6.5 7.5
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(5.5, 2.5);
    //console.log("case2");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 8 9 10
    //output_number_arr(removed);                      // 6.5 7.5
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(5.5, 7.5, 1.5, 2.5);       // start + delete_count > len
    //console.log("case3");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 1.5 2.5
    //output_number_arr(removed);                      // 6.5 7.5 8 9 10
    /** the value of start:[-len + 1,0), start will be converted to start + len
     *  the value of deleteCount:[0,len]
     */
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(-5.5, 2.5, 1.5);    // delete count > count of new elements
    //console.log("case4");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 1.5 8 9 10
    //output_number_arr(removed);                      // 6.5 7.5
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(-5.5, 2.5);
    //console.log("case5");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 8 9 10
    //output_number_arr(removed);                      // 6.5 7.5

    /** the value of start >= len, no elements will be removed
     *  the new elements will be added at the end of array
     */
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(11, 2.5, 1.5, 2.5);
    //console.log("case6");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 6.5 7.5 8 9 10 1.5 2.5
    //output_number_arr(removed);
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(10, 0);
    //console.log("case7");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 6.5 7.5 8 9 10
    //output_number_arr(removed);

    /** the value of start:[0,len -1]
     *  the value of deleteCount <= 0, no elements will be removed
     *  the new elements will be added behind arr[start]
     */
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(5, 0, 11);
    //console.log("case8");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 11 6.5 7.5 8 9 10
    //output_number_arr(removed);
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(5, -10, 11);
    //console.log("case9");
    //output_number_arr(arr);                          // 1.5 2.5 3 4 5 11 6.5 7.5 8 9 10
    //output_number_arr(removed);

    /** the value of start < -len, start will be converted to 0
     *  the value of deleteCount:[0, len -1]
     *
     */
    arr = [1.5, 2.5, 3, 4, 5, 6.5, 7.5, 8, 9, 10];
    removed = arr.splice(-20, 2, 11);
    //console.log("case10");
    //output_number_arr(arr);                          // 11 3 4 5 6.5 7.5 8 9 10
    //output_number_arr(removed);                      // 1.5 2.5
    arr.splice(0);
    console.log(arr.length);
    return removed.length;
}

export function array_splice_boolean() {
    let arr: boolean[] = [true, false, true];
    let removed = arr.splice(1, 1, true);
    //output_arr_boolean(arr);                      // true true true
    //output_arr_boolean(removed);                  // false
    return removed.length;
}

export function array_splice_string() {
    let arr: string[] = ["hello", "world", "nihao"];
    let removed = arr.splice(1, 1, "hi");
    //output_arr_string(arr);                      // hello hi nihao
    //output_arr_string(removed);                  // world
    return removed.length;
}

export function array_splice_class() {
    let arr: A[] = [new A("A1"), new A("A2"), new A("A3")];
    let removed = arr.splice(1, 1, new A("A4"));
    //output_arr_class(arr);                      // A1 A4 A3
    //output_arr_class(removed);                  // A2
    return removed.length;
}

export function array_splice_interface() {
    let arr: I[] = [{ x: 'A1' }, { x: 'A2' }, { x: 'A3' }];
    let obj = new A("A4");
    let i: I = obj;
    let removed = arr.splice(1, 1, i);
    //output_arr_interface(arr);                      // A1 A4 A3
    //output_arr_interface(removed);                  // A2
    return removed.length;
}