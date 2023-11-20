/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A1 {
    // empty constructor
    test() {
        return 123;
    }

    test2() {
        return 1;
    }
}

class A2 {
    public _a: number;
    constructor(a: number) {
        this._a = a;
    }
    public testFunc() {
        this._a = 10;
    }
    get a() {
        return this._a;
    }
    set a(m: number) {
        this._a = m;
    }
}

export function withoutCtor() {
    let a: A1 = new A1();
    let b = a.test();
    return b;
}

export function basic() {
    let a: A2 = new A2(10);
    return a.a;
}

class A9 {
    public _a: number;
    constructor(a: number) {
        this._a = a;
    }
    set a(m: number) {
        this._a = m;
    }
    get a() {
        return this._a;
    }
    test(m: number) {
        return m;
    }
    test1() {}
}

export function getterSetter() {
    let a: A9 = new A9(10);
    let i = a._a;
    a.a = i;
    let j = a.test(5);
    let k = a.a;
    return i + j + k;
}

// class with any type fields
class A3 {
    public _a: any;
    constructor(a: any) {
        this._a = a;
    }
    public testFunc() {
        this._a = 10;
    }
    get a() {
        return this._a;
    }
    set a(m: any) {
        this._a = m;
    }
}

export function anyType() {
    const a: A3 = new A3(10);
    return a.a as number;
}

class Base {
    _arg: number;
    _arg1: number;

    constructor(arg: number, arg1: number) {
        this._arg = arg;
        this._arg1 = arg1;
    }

    test() {
        return this._arg + this._arg1;
    }
}

class Derived extends Base {
    //
}

export function defaultCtor() {
    const a = new Derived(1, 2);
    return a.test();
}

class Test {
    foo(x: number) {
        return function bar(y: number) {
            return function baz(z: number) {
                return x + y + z;
            };
        };
    }
    static bar(x: number) {
        return function baz(y: number) {
            return function foo(z: number) {
                return x + y + z;
            };
        };
    }
    baz() {
        return new Derived(1, 2);
    }

    static baz1() {
        return new Derived(1, 2);
    }
}

export function classNestCall() {
    const t = new Test();
    return (
        t.foo(1)(2)(3) +
        Test.bar(1)(2)(3) +
        t.baz().test() +
        Test.baz1().test() +
        t.baz()._arg +
        Test.baz1()._arg
    ); // 20
}

/** this as free variable */
class Foo {
    id: number;
    constructor(idd: number) {
        this.id = idd;
    }
}

class Bar extends Foo {
    name: string;
    constructor(idd: number, namee: string) {
        super(idd);
        this.name = namee;
    }

    test(addr: number) {
        const b = () => {
            if (this.name === 'foo') {
                return this.id + addr;
            }
            this.id++;
            return this.id;
        };
        this.id++;
        return b;
    }
}

export function thisAsFreeVar() {
    const b = new Bar(11, 'foo');
    const c = b.test(10);
    console.log(c()); // 22
}

export function classInClosure() {
    class A {
        foo() {
            console.log(1);
        }
    }
    class B {
        x: number;
        constructor(x: number) {
            this.x = x;
        }
        bar() {
            console.log(this.x);
        }
    }

    const a = new A();
    a.foo();
    const b = new B(2);
    b.bar();
}

class C {
    _onclick: () => void;

    constructor() {
        this._onclick = () => {console.log('')};
    }
    set onclick(value: () => void) {
        this._onclick = value;
    }
    get onclick(): () => void {
        return this._onclick;
    }
}

export function test() {
    const c = new C();
    c.onclick = () => {console.log('click')};
    const click = c.onclick;
    click();
}