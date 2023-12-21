/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function addAnyAny() {
    let a: any = 1;
    let b: any = 2;
    let c: any = a + b;
    return c as number;
}

export function addNumberAnyInBinaryExpr() {
    let a: any = 1;
    let b: any;
    let c: any = 100;
    b = (a + 1) * c;
    return b as number;
}

export function addNumberAnyInMulExpr() {
    let a: any = 1;
    let c: any;
    c = 2 + a + 6;
    return c as number;
}

export function anyCmp() {
    const a: any = 10,
        b: any = 10,
        b2: any = 11;
    const c: any = false,
        d: any = true,
        d2: any = false,
        e: any = '123',
        f: any = '123',
        f2: any = '234';

    console.log(c === d); // false
    console.log(c === d2); // true
    console.log(a === b); // true
    console.log(a === b2); // false
    console.log(a <= b); // true
    console.log(a > b); // false

    console.log(e > f); // false
    console.log(e < f2); // true
    console.log(e === f); // true
    console.log(e != f); // false
    console.log(e === f2); // false
}

export function anyNullUndefinedCmp() {
    const n1: any = null,
        n2: any = null;
    const u1: any = undefined,
        u2: any = undefined;

    console.log(n1 == n2); // true
    console.log(n1 == u1); // false
    console.log(u1 == u2); // true

    console.log(u1 === undefined); // true
    console.log(u1 !== undefined); // false
    console.log(n2 === null); // true
    console.log(n2 !== null); // false
}

export function anyMinusAny() {
    let a: any = 10;
    let b: any = 5;
    let c: any = a - b;
    console.log(c);
}

export function anyDivideAny() {
    let a: any = 10;
    let b: any = 5;
    let c: any = a / b;
    console.log(c);
}

export function anyMultiplyAny() {
    let a: any = 10;
    let b: any = 5;
    let c: any = a * b;
    console.log(c);
}

export function anyModAny() {
    let a: any = 10;
    let b: any = 5;
    let c: any = a % b;
    console.log(c);
}

export function addAnyInBinaryExpr() {
    const str1: any = 'str11';
    let str2: any;
    const str3: any = 'str33';
    str2 = str1 + 'a' + str3;
    console.log(str2);
}

export function anyCmpNum() {
    let a: any = 10;
    if (a > 9) {
        console.log('Greater than 9');
    } else {
        console.log('Less than 9');
    }

    if(11 > a) {
        console.log('Less than 11');
    } else {
        console.log('Greater than 11');
    }
}
