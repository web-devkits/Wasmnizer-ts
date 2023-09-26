/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x = 10;
    static fooA() {
        return 10;
    }
}

class B {
    y = 20;
    static fooB() {
        return 20;
    }
}

function test1() {
    const a: A | null = new A();
    return a.x;
}

function test2() {
    let a: A | number = new A();
    a = a.x + 10;
    return a;
}

function test3() {
    let a: A | B | null = new A();
    let x = a.x;

    a = new B();
    let y = a.y;
}

function test4() {
    let a: A | B | string = new A();
    let x = a.x;

    a = new B();
    let y = a.y;

    a = "hello world";
}

function test_any_null() : any | null {
    return null;
}

export function test_func_return_any_null()
{
    if (test_any_null() === null) {
        console.log("is null");
    }
    else {
        console.log("not null");
    }
}
