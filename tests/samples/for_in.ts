/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    [key: string]: number;
}

interface I_FUNC {
    [key: string]: () => number;
}

export function infc_obj_get_field() {
    const obj: I = {
        x: 1,
        y: 2,
    };
    for (const key in obj) {
        console.log(obj[key]);
    }
}

export function infc_obj_set_field() {
    const obj: I = {
        x: 1,
        y: 2,
    };
    for (const key in obj) {
        obj[key] = 100;
        console.log(obj[key]);
    }
}

export function infc_obj_get_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
    };
    for (const key in obj) {
        const a = obj[key];
        console.log(a());
    }
}

export function infc_obj_set_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
    };
    for (const key in obj) {
        obj[key] = () => 100;
        const a = obj[key];
        console.log(a());
    }
}

class A {
    a = 1;
    b = 2;
}

export function extref_obj() {
    const obj: any = new A();
    for (const key in obj) {
        const value = obj[key];
        console.log(value);
        obj[key] = 88;
        console.log(obj[key]);
    }
}

export function dynamic_obj() {
    const obj: any = {a: 1, b: 2};
    for (const key in obj) {
        const value = obj[key];
        console.log(value);
        obj[key] = 88;
        console.log(obj[key]);
    }
}

export function mix_obj() {
    const a = new A();
    const obj: any = a;
    obj['c'] = 3;
    for (const key in obj) {
        const value = obj[key];
        console.log(value);
        obj[key] = 88;
        console.log(obj[key]);
    }
}

export function forInWithContinue() {
    const expect = ['b', 'd', 'c', 'd', 'e', 'a', 'c', 'd'];
    const result: string[] = [];

    let obj: I = { a: 1, b: 2, c: 3, d: 4 };

    for (const key in obj) {
        if (obj[key] % 2 !== 0) {
            continue;
        }
        result.push(key);
    }

    obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    for (const key in obj) {
        if (obj[key] < 3) continue;
        if (obj[key] > 5) continue;
        result.push(key);
    }

    obj = { a: 1, b: 2, c: 3, d: 4 };

    for (const key in obj) {
        if (obj[key] % 2 === 0) {
            if (obj[key] === 2) continue;
            result.push(key);
        } else {
            result.push(key);
        }
    }

    if (result.length !== expect.length) {
        return false;
    }
    for (let i = 0; i < expect.length; i++) {
        if (result[i] !== expect[i]) {
            return false;
        }
    }
    return true;
}
