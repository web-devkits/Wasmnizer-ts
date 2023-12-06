/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A{
    x: string[];
    constructor(){
        this.x = [];
    }
}

export function assignStringArray() {
    const a = new A();
    a.x.push('hello');
    console.log(a.x[0]);
}

interface I {
    instance: number;
}

type cbType = (v: I) => number;

class B {
    x: Array<cbType>;
    constructor() {
        this.x = [];
    }
}

function elemFunc(a: I) {
    return a.instance;
}

export function assignClosureArray() {
    const a = new B();
    const i: I = {
        instance: 100,
    };
    a.x.push(elemFunc);
    console.log(a.x[0](i));
}
