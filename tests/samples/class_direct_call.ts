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
