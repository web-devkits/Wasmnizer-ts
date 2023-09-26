/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x = 10;
}

export function test() {
    let a = 1;
    a += 2;
    console.log(a);

    const b: number[] = [1, 2, 3];
    b[1] += b[1] * 3;
    console.log(b[1]);

    const c = new A();
    c.x -= c.x / 2;
    console.log(c.x);

    let d = 'hello';
    d += ' world';
    console.log(d);
}