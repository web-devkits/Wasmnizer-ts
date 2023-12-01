/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    f1: () => void;
    f2: () => void;
}

class A {
    f1() {
        console.log('METHOD');
    }
    f2 = () => {
        console.log('FIELD');
    };
}

export function callClassTypedFunc() {
    const a = new A();
    a.f1();
    a.f2();
}

export function callClassTypedClosure() {
    const a = new A();
    const f1 = a.f1;
    const f2 = a.f2;
    f1();
    f2();
}

export function callInfcTypedFunc() {
    const a: I = new A();
    a.f1();
    a.f2();
}

export function callInfcTypedClosure() {
    const a: I = new A();
    const f1 = a.f1;
    const f2 = a.f2;
    f1();
    f2();
}
