/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x: number;
    constructor(xx: number) {
        this.x = xx;
    }
}

export function autoBoxUnboxAssign() {
    let a: any = 1;
    let b: number = a;
    console.log(b); // 1
    b = 2;
    a = b;
    console.log(a); // 2

    a = 'str';
    let b1: string = a;
    console.log(b1); // str
    a = 'str1';
    b1 = a;
    console.log(b1); // str1

    a = new A(10);
    let b2: A = a;
    console.log(b2.x); // 10
    a = new A(11);
    b2 = a;
    console.log(b2.x); // 11
}

function helper(a: any) {
    const b: A = a;
    return b.x;
}

function helper1(a: A) {
    return a.x;
}

function helper2(): any {
    const a = new A(10);
    return a;
}

function helper3(): A {
    const a = new A(10);
    return a;
}

export function autoBoxUnboxObjParam() {
    const a: any = new A(20);
    console.log(helper(new A(10)) + helper1(a)); // 30
    console.log((helper2() as A).x + helper3().x); // 20
}

class B {
    x: any;
    y: any = new A(10);
    z1: A = new A(-1);
    static z2: any = new A(10);

    constructor(xx: A) {
        this.x = xx;
    }
    add() {
        return (this.x as A).x + (this.y as A).x + (B.z2 as A).x;
    }
    box(a: A) {
        this.x = a;
    }
    unbox(a: any) {
        this.z1 = a;
    }
}

export function autoBoxunboxObjField() {
    const b = new B(new A(10));
    console.log(b.add()); // 30

    const a1 = new A(100);
    b.box(a1);
    console.log((b.x as A).x); // 100;
    b.unbox(b.x);
    console.log(b.z1.x); // 100;
}
