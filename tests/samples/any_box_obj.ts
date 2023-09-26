/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function boxEmptyObj() {
    let a: any = {};
    return a;
}

export function boxObjWithNumberProp() {
    let obj: any = {
        a: 1,
    };
    return obj.a as number;
}

export function boxObjWithBooleanProp() {
    let obj: any;
    obj = {
        c: true,
    };
    return obj.c as boolean;
}

export function boxNestedObj() {
    let obj: any;
    obj = {
        a: 1,
        c: true,
        d: {
            e: 1,
        },
    };
    return obj.d.e as number;
}

class A {
    x = '10';
    constructor(xx: string) {
        this.x = xx;
    }
}

function test(str: string) {
    const a1: any = new A(str);
    return a1;
}

export function anyPointToObj() {
    let b = new A('100');
    for (let i = 0; i < 100; i++) {
        b = test('123') as A;
    }
    return b.x;
}
