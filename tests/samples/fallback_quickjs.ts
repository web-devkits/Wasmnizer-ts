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

class VNode {
    _data: any;
    _data2: any = new Map();
    static _data3: any = new Map();
    constructor() {
        this._data = new Map();
    }
}

export function mapTest() {
    const a: any = new Map();
    const k: any = 1;
    const v: any = 2;
    a.set(k, v);
    console.log(a.get(1)); // 2
    a.clear();
    console.log(a.get(1)); // undefined
    a.set('hello', 'world');
    console.log(a.get('hello')); // world
    a.delete('hello');
    console.log(a.get('hello')); // undefined

    const obj1 = new A(10);
    const o1: any = obj1;
    const obj2 = new A(11);
    const o2: any = obj2;
    a.set(o1, o2);
    console.log(a.has(o1)); // true
    console.log(a.has(o2)); // false
    const key = a.get(o1) as A;
    console.log(key.x); // 11
    console.log(a.size); //1
    if (a.has(o1)) {
        console.log(1);
    }
    if (a.has(o2)) {
        console.log(2);
    }

    const vn = new VNode();
    vn._data.set('a', 1);
    vn._data2.set('a', 1);
    VNode._data3.set('a', 1);
    console.log(vn._data.get('a') + vn._data2.get('a') + VNode._data3.get('a')); // 3
}

export function setTest() {
    const tset: any = new Set();
    const v1: any = 1;
    const v2: any = true;
    tset.add(v1);
    tset.add(v2);
    console.log(tset.has(v1)); // true
    tset.clear();
    tset.add('hello');
    tset.add('world');
    console.log(tset.size); // 2

    const obj1 = new A(10);
    const o1: any = obj1;
    console.log(o1); // object
    const obj2 = new A(11);
    const o2: any = obj2;
    tset.add(o1);
    tset.add(o2);
    console.log(tset.has(o1)); // true
    console.log(tset.has(o2)); // true
    console.log(tset.size); // 4

}