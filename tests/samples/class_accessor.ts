/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A1 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test1() {
    const instanceA1 = new A1(1);
    instanceA1.ref = 2;
    console.log(instanceA1.ref);
}

class A2 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
}
export function test2() {
    const instanceA2 = new A2(1);
    instanceA2.ref = 2;
    console.log(instanceA2.ref);
}

class A3 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test3() {
    const instanceA3 = new A3(1);
    console.log(instanceA3.ref);
}

class B1 extends A1 {
    constructor(ref_value: number) {
        super(ref_value);
    }
}
export function test4() {
    const instanceB1 = new B1(1);
    instanceB1.ref = 2;
    console.log(instanceB1.ref);
}

class B2 extends A2 {
    constructor(ref_value: number) {
        super(ref_value);
    }
}
export function test5() {
    const instanceB2 = new B2(1);
    instanceB2.ref = 2;
    console.log(instanceB2.ref);
}

class C1 extends A1 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test6() {
    const instanceC1 = new C1(1);
    instanceC1.ref = 2;
    console.log(instanceC1.ref);
}

class C2 extends A2 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test7() {
    const instanceC = new C2(1);
    instanceC.ref = 2;
    console.log(instanceC.ref);
}

class C3 extends A3 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test8() {
    const instanceC3 = new C3(1);
    instanceC3.ref = 2;
    console.log(instanceC3.ref);
}

class D1 extends A1 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
}
export function test9() {
    const instanceD1 = new D1(1);
    instanceD1.ref = 2;
    console.log(instanceD1.ref);
}

class D2 extends A2 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
}
export function test10() {
    const instanceD2 = new D2(1);
    instanceD2.ref = 2;
    console.log(instanceD2.ref);
}

class D3 extends A3 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    set ref(value: number) {
        this._ref = value;
    }
}
export function test11() {
    const instanceD3 = new D3(1);
    instanceD3.ref = 2;
    console.log(instanceD3.ref);
}

class E1 extends A1 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    get ref(): number {
        return this._ref;
    }
}
export function test12() {
    const instanceE1 = new E1(1);
    console.log(instanceE1.ref);
}

class E2 extends A2 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    get ref(): number {
        return this._ref;
    }
}
export function test13() {
    const instanceE = new E2(1);
    console.log(instanceE.ref);
}

class E3 extends A3 {
    constructor(ref_value: number) {
        super(ref_value);
    }

    get ref(): number {
        return this._ref;
    }
}
export function test14() {
    const instanceE3 = new E3(1);
    console.log(instanceE3.ref);
}

interface I1 {
    _ref: number;
    set ref(value: number);
}

interface I2 {
    _ref: number;
    get ref(): number;
}

interface I3 {
    _ref: number;
    set ref(value: number);
    get ref(): number;
}

class X1 implements I1 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
}

class X2 implements I1 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}

class Y1 implements I2 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    get ref(): number {
        return this._ref;
    }
}

class Y2 implements I2 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}

class Z implements I3 {
    _ref: number;

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._ref;
    }
}
export function test15() {
    let i1: I1 = new X1(1);
    i1.ref = 2;
    console.log(i1.ref);
    i1= new X2(1);
    i1.ref = 2;
    console.log(i1.ref);

    let i2: I2 = new Y1(1);
    console.log(i2.ref);
    i2= new Y2(1);
    console.log(i2.ref);

    const i3: I3 = new Z(1);
    i3.ref = 2;
    console.log(i3.ref);
}