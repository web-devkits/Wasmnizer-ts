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

function foo(param: any) {
    for (let key in param) {
        if(key == 'children') {
            console.log(typeof param[key]);
        } else {
            console.log(`${key}: ${param[key]}`);
        }
    }
}
export function boxObjWithProps() {
    const a: any = {
        tag: "a",
        x: 1,
        children: [
            {
                tag: 'child0',
                text: 'string: 1',
            },
            {
                tag: 'child1',
                text: 'string: 2',
            }
        ]
    };
    const b: any = {
        children: [
            {
                tag: 'child0',
                text: 'string: 3',
            },
            {
                tag: 'child1',
                text: 4,
            }
        ]
    };

    foo(a);
    console.log(b.children[0].text);
    console.log(b.children[1].text);
}
