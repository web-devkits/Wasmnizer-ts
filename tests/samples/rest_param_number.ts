/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function restParameterTest() {
    function bar1(a: number, ...b: number[]) {
        const c = a + b[0] + b[1];
        return c;
    }
    function bar2(a: number, ...b: number[]) {
        return a;
    }
    return bar1(10, 11, 12, 13) + bar2(14);
}

// 47

function test(a?: string) {
    if (a) {
        console.log(a);
        a = undefined;
    } else {
        console.log('undefined');
    }
}

export function undefinedAsCond() {
    test('hello');
    test(undefined);
}

class A {
    //
}

export function anyrefCond() {
    test('hello');
    const a = new A();
    const v: any = a;
    if (v) {
        console.log('v');
    }
    const a1: A | null = null;
    const v1: any = a1;
    if (v1) {
        console.log('v1');
    }
    let a2 = '';
    const v2: any = a2;
    if (v2) {
        console.log('v2');
    }
    a2 = 'hello';
    const v3: any = a2;
    if (v3) {
        console.log('v3');
    }
    const v4: any = '';
    if (v4) {
        console.log('v4');
    }
    const v5: any = 'hello';
    if (v5) {
        console.log('v5');
    }
    const v6: any = 0;
    if (v6) {
        console.log('v6');
    }
    const v7: any = 1;
    if (v7) {
        console.log('v7');
    }
    const v8: any = undefined;
    if (v8) {
        console.log('v8');
    }
    const v9: any = false;
    if (v9) {
        console.log('v9');
    }
    const v10: any = true;
    if (v10) {
        console.log('v10');
    }
    const v11: any = {};
    if (v11) {
        console.log('v11');
    }
    const v12: any = { a: 11 };
    if (v12) {
        console.log('v12');
    }
}

function foo(...num: number[]) {
    let res = 0;
    for (let i = 0; i < num.length; i++) {
        res += num[i];
    }
    return res;
}

export function restParamWithEmpty() {
    console.log(foo(1, 2));
    console.log(foo());
}
