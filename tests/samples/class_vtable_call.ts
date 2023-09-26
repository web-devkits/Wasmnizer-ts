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

function foo(n: number) {
    let a = new A();
    if (n > 10) {
        a = new B();
    }
    return a;
}

export function bar() {
    let a = foo(1);
    a.test();
    a = foo(20);
    a.test();
}
