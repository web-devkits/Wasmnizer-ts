/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function stringConcat() {
    const a: string = 'hello';
    const b: string = a.concat('world');
    return b;
}

export function stringLength() {
    const a: string = 'hello';
    const b: number = a.length;
    return b;
}

export function stringSliceWithTwoNegativeNumber() {
    const a: string = 'hello';
    const b: string = a.slice(-1, -3);
    return b;
}

export function stringSliceWithTwoPositiveNumber() {
    const a: string = 'hello';
    const b: string = a.slice(1, 3);
    return b;
}

export function stringSliceWithTwoUndefind() {
    const a: string = 'hello';
    const b: string = a.slice(undefined, undefined);
    return b;
}

export function stringSliceWithOneZero() {
    const a: string = 'abcdef';
    const b: string = a.slice(0, 2);
    console.log(b);
}

export function stringIndexOf() {
    const a: string = 'helloxxxxkasdfhello';
    let x: number = a.indexOf('kasd');   // 9
    console.log(x)
    x = a.indexOf('kh'); // -1
    console.log(x)
    return x;
}

function outputStrArr(arr: string[]) {
    for (let i = 0; i < arr.length; i++) {
        let str = arr[i];
        console.log(str)
    }
}

export function stringSplit() {
    let a: string = 'h-e-l-l-o';
    let arr: string[] = a.split('-'); // ['h', 'e', 'l', 'l', 'o']
    outputStrArr(arr);
    a = 'hellohe';
    arr = a.split('he'); // ['', 'llo', '']
    outputStrArr(arr)
    return arr;
}

export function stringReplace() {
    const a: string = 'hellokhello';
    // replace longer string  ->   hellokhello
    let na: string = a.replace("hellokhelloo", '-');
    console.log(na);
    // replace unmatched string -> hellokhello
    na = a.replace("pqr", "-");
    console.log(na);
    // replace string hello-hello
    na = a.replace("k", '-');
    console.log(na);
    // match empty -> -hellokhello
    na = a.replace("", "-");
    console.log(na);
    // replace with nothing -> hellohello
    na = a.replace("k", "");
    console.log(na);
}

export function stringMatch() {
    const str: string = "hello world hello world";
    let arr: string[] = str.match("hello");
    outputStrArr(arr);          // ["hello"]
    arr = str.match("orld");
    outputStrArr(arr);          // ["orld"]
    arr = str.match("");
    outputStrArr(arr);          // [""]
    return arr;
}

export function stringSearch() {
    const str: string = "hello world hello world";
    let idx: number = str.search("hello");
    console.log(idx);               // 0
    idx = str.search("orld");
    console.log(idx);               // 7
    idx = str.search("helloworld");
    console.log(idx);               // -1
    idx = str.search("");
    console.log(idx);               // 0
    return idx;
}

export function stringcharAt() {
    const a: string = 'hello world';
    let b: string = a.charAt(0);
    console.log(b);
}

export function stringtoLowerCase() {
    const a: string = 'HELLO';
    let b: string = a.toLowerCase();
    console.log(b);
}

export function stringtoUpperCase() {
    const a: string = 'Hello';
    let b: string = a.toUpperCase();
    console.log(b);
}

export function stringtrim() {
    const a: string = '  hello  ';
    let b: string = a.trim();
    console.log(b);
}

export function stringreadonly() {
    const a: string = 'hello';
    let b: string = a[1];
    console.log(b);
}

export function stringadd() {
    const a: string = 'hello';
    const b: string = ' world';
    console.log(a + b);
}