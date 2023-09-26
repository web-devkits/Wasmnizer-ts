/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    x: number;
    constructor(xx: number) {
        this.x = xx;
    }
}

function helper(a: any) {
    const b: A = a;
    return b.x;
}

let temp_a = new A(2023);
console.log(helper(temp_a))
