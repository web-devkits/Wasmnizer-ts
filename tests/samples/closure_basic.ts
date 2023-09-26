/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function closure1(x: number, y: boolean) {
    let z = 1;
    function inner(z: number) {
        function inner1(a: number) {
            const m = 1;
            return m + z + a + x; // 4
        }
        return inner1;
    }
    return inner;
}

export function accessOuterVars() {
    const f1 = closure1(1, false);
    const f2 = f1(1);
    const res = f2(1);
    return res;
}

function closure2(x: number, y: boolean) {
    let z = 1;
    z += 10;
    function inner() {
        z = 10;
        return z;
    }
    return inner;
}

export function returnOuterFuncCall() {
    const f1 = closure2(1, false);
    return f1();
}

export function returnOuterFuncCall2() {
    return closure1(1, false)(1)(1); // 4
}

let y = '123';

export function accesssGlobalVar() {
    function inner1() {
        return y;
    }
    return inner1;
}

class A {
    x: (m: number) => number;

    constructor(xx: (m: number) => number) {
        this.x = xx;
    }
}

class B {
    y = 'hello';
}

class AA {
    x: (m: number) => number;
    y = (m: number, b: B) => {
        if (b.y === 'hello') {
            return m + 1;
        }
        return m;
    };

    constructor(xx: (m: number) => number) {
        this.x = xx;
    }
}

function foo() {
    const m = 10;
    const param = (x: number) => {
        return x + m;
    };
    return param;
}

export function classFieldIsClosure() {
    const a = new A(foo());
    console.log(a.x(10));
}

export function classFieldIsClosureWithDefault() {
    const a = new AA(foo());
    const b = new B();
    console.log(a.x(10) + a.y(20, b));
}

export function nullable_closure(): any | null {
    const handler: ((events: any) => any) | null = (a) => {
        console.log(a);
        return a;
    };
    if (handler) {
        return handler('hello');
    }
}
