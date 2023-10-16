/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    test() {
        console.log('a');
    }
}

class B extends A {
    sayHi() {
        console.log('hi');
    }
    test() {
        console.log('b');
    }
}

export function foo() {
    let n = 5;
    let a = new A();
    if (n > 10) {
        a = new B();
    }
    a.test()
    n = 18;
    a = new A();
    if (n > 10) {
        a = new B();
    }
    a.test();
}

class Foo {
    method_foo1(arr: number[]): number {
        return 1;
    }

    method_foo2(a: number, ...b: number[]) {
        const c = a + b[0] + b[1];
        return c;
    }

    method_foo3(a: number, ...b: number[]) {
        return a;
    }

    method_foo4(...num: number[]) {
        let res = 0;
        for (let i = 0; i < num.length; i++) {
            res += num[i];
        }
        return res;
    }
}

function func_foo(arr: number[]): number {
    return 2;
}

export function test() {
    const a = new Foo();
    const arr: number[] = [1, 3, 5, 7];
    console.log(a.method_foo1(arr));
    console.log(a.method_foo2(1, 2, 3, 4) + a.method_foo3(5));
    console.log(a.method_foo4(1, 2));
    console.log(a.method_foo4());
    console.log(func_foo(arr));
}