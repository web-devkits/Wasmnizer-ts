/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x: any = -1;
    y = false;
    z = 222;
    i = '123';
}

export function mixTypeInClass() {
    const a = new A();
    let b: any = a;
    b.x = '1';
    b.y = true;
    b.z = 0;
    b.i = '0';
    b.j = '00';
    console.log(b.x);
    console.log(b.y);
    console.log(b.z);
    console.log(b.i);
    console.log(b.j);

    const c = a as A;
    console.log(c.x);
    console.log(c.y);
    console.log(c.z);
    console.log(c.i);
}

interface I {
    x: any;
    i: string;
    z: number;
    y: boolean;
}
export function mixTypeInInfc() {
    const a: I = new A();
    let b: any = a;
    b.x = '2';
    b.y = true;
    b.z = -1;
    b.i = '-1';
    b.j = '--1';
    console.log(b.x);
    console.log(b.y);
    console.log(b.z);
    console.log(b.i);
    console.log(b.j);

    const c = a as I;
    console.log(c.x);
    console.log(c.y);
    console.log(c.z);
    console.log(c.i);
}
