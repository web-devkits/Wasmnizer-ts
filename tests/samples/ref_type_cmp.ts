/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class C {
    x = 10;
    y = 11;
    test() {
        return 10;
    }
}
export function structCmpEq() {
    const c1 = new C();
    const c2 = c1;
    const c3 = c1;
    return c2 == c3;
}

export function structCmpNotEq() {
    const c1 = new C();
    const c2 = new C();
    return c2 == c1;
}

export function arrayCmpEq() {
    const arr1 = new Array<string>();
    arr1.push('12');
    const arr2 = arr1;
    const arr3 = arr1;
    return arr2 == arr3;
}

export function arrayCmpNotEq() {
    const arr1 = new Array<string>();
    const arr2 = new Array<string>();
    return arr2 == arr1;
}

interface I {
    x: number;
    y: number;
    test: () => number;
}

export function infcCmpEq() {
    const c = new C();
    const i1: I = c;
    const i2: I = c;
    return i1 == i2;
}

export function infcCmpNotEq() {
    const c = new C();
    const i1: I = new C();
    const i2: I = c;
    return i1 == i2;
}

interface I2 {
    x: number;
    y: string;
}

export function infcClassCmpEq() {
    const obj = { y: '123', x: 123 };
    const i: I2 = obj;
    return i === obj;
}

export function infcClassCmpNotEq() {
    const obj1 = { y: '123', x: 123 };
    const i1: I2 = obj1;
    const obj2 = { y: '123', x: 123 };
    const i2: I2 = obj2;
    return i1 === i2;
}
