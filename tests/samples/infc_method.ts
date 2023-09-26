/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    x: number;
    y: boolean;
    get _x(): number;
    set _x(x: number);
}

class Foo {
    y: boolean;
    z: string;
    x: number;
    constructor() {
        this.x = 1;
        this.y = false;
        this.z = 'str';
    }
    test() {
        return this.y;
    }

    set _x(x: number) {
        this.x = x;
    }

    get _x() {
        return this.x;
    }
}

export function infcSetter() {
    const f = new Foo();
    const i: I = f;
    i._x = 10;
    return i._x;
}

interface I2 {
    x: number;
    y: boolean;
    test: () => boolean;
}

export function infcMethod() {
    const f = new Foo();
    const i: I2 = f;
    return i.test();
}

export function infcGetter() {
    const f = new Foo();
    const i: I = f;
    const m = i._x;
    return m;
}

interface I3 {
    x: (y: number) => (z: number) => number;
    y: () => Foo;
}

class Test {
    x(m: number) {
        return function (n: number) {
            return m + n;
        };
    }
    y(){
        return new Foo();
    }
}

export function infcNestMethod() {
    const t = new Test();
    const i: I3 = t;
    const f = i.y()._x + (i.y().test() ? 1 : 2) + i.x(1)(2);
    return f; //6
}

interface I5 {
    func1: () => boolean;
    func2: () => number;
}

class C5 {
    func1() {
        return false;
    }
    func2() {
        return 1;
    }
}

export function infcMethodWithAnyInst() {
    const i: I5 = new C5;
    const a: any = i;
    return (a as I5).func2();

}
