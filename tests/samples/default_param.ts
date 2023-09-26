/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    add(x: number, y: number, z = 5) {
        return x + y + z;
    }

    static add_static(x: number, y: number, z = 5) {
        return x + y + z;
    }
}

export function defaultParamInMethod() {
    const a = new A();
    console.log(a.add(1, 2));
}

export function defaultParamInStaticMethod() {
    const a = new A();
    console.log(A.add_static(1, 2));
}

function add(x: number, y: number, z = 5) {
    return x + y + z;
}

export function defaultParamInFunction() {
    console.log(add(1, 2));
}

/* Hint: closure call's default param is not supported */