/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    x?: number;
    y?: string;
}

class B {
    num: number;
    i: I;
    constructor(ii: I, numm: number) {
        this.i = ii;
        this.num = numm;
    }
}

export function optionalField() {
    const b1 = new B({ x: 10, y: 'str' }, 10);

    const z = b1.i.y;
    console.log(z);
    b1.i.y = 'str1';
    console.log(b1.i.y);

    const i: I = { x: 10 };
    const b2 = new B(i, 11);
    console.log(b2.i.y);
}

interface I1 {
    x?: () => number;
}

class A1 {
    num: number;
    x() {
        return this.num;
    }
    constructor(num: number) {
        this.num = num;
    }
}

class A11 {
    //
}
export function optionalMethod() {
    const a = new A1(10);
    const i: I1 = a;
    let res1 = -1;
    if (i.x) {
        res1 = i.x();
    }
    console.log(res1);
    let res2 = -1;
    const x = i.x;
    if (x) {
        // TODO: not support call closure of class method now
        // res2 = x();
        res2 = 10;
    }
    console.log(res2);
    const res3 = i.x ? i.x() : -1;
    console.log(res3);
    let res4 = 0;
    const i11: I1 = new A11();
    if (i11.x) {
        res4 += 10;
    }
    console.log(res4);
}

class A {
    x?: number;
}

export function classOptionalField() {
    const a = new A();
    console.log(a.x);
    a.x = 10;
    console.log(a.x);
}

class B2 {
    str = 'hello';
}

class A2 {
    b?: B2;
}

export function accessOptFieldOfOptField() {
    const a = new A2();
    if (a.b) {
        console.log(a.b.str);
    }
    console.log(a.b?.str);
    a.b = new B2();
    if (a.b) {
        console.log(a.b.str);
    }
    console.log(a.b?.str);
}


interface ITreeNode {
    left?: ITreeNode;
    right?: ITreeNode;
}
function checksum(node?: ITreeNode): number {
    if (!node) {
        return 1;
    }
    return 1 + checksum(node.left) + checksum(node.right);
}

export function accessOptionalUnionField() {
    const l: ITreeNode = {};
    const r: ITreeNode = {};
    const node: ITreeNode = {left: l, right: r};
    const node1 = {left: l, right: r};
    return checksum(node) + checksum(node1);
}

interface I2 {
    x?: number | boolean;
}

interface I3 {
    x: number | boolean;
}

class Foo {
    y = 10;
}
class Bar {
    y = 11;
}

interface I4 {
    x?: Foo | Bar;
}

interface I5 {
    x: Foo | Bar;
}

interface I6 {
    y?: I4;
}

interface I7 {
    y: I4 | I5;
}

interface I8 {
    y?: I4 | I5;
}

export function accessOptionalUnionField2() {
    let i2: I2 = { x: true };
    console.log(i2.x);
    i2 = {};
    console.log(i2.x);

    let i3: I3 = { x: true };
    console.log(i3.x);
    i3 = { x: 10 };
    console.log(i3.x);
    // It should not work, because `x` comes from {x: false}
    // i3.x = 10;
    // console.log(i3.x);

    const i4: I4 = { x: new Foo() };
    if (i4.x) {
        console.log(i4.x.y);
    }
    i4.x = new Bar();
    if (i4.x) {
        console.log(i4.x.y);
    }

    const I5: I5 = { x: new Bar() };
    const x = I5.x;
    if (x instanceof Foo) {
        console.log(x.y);
    } else {
        console.log(x.y);
    }

    const i6: I6 = { y: { x: new Foo() } };
    // console.log();
    if (i6.y) {
        const x = i6.y.x;
        if (x instanceof Foo) {
            console.log(x.y);
        }
    }

    const i7: I7 = { y: { x: new Bar() } };
    const obj = i7.y;
    const x1 = obj.x;
    if (x1) {
        if (x1 instanceof Foo) {
            console.log(x1.y);
        } else {
            console.log(x1.y);
        }
    }

    const i8: I8 = { y: { x: new Foo() } };
    const obj1 = i8.y;
    let x11: Foo | Bar | undefined = undefined;
    if (obj1) {
        x11 = obj1.x;
    }
    if (x11) {
        if (x11 instanceof Foo) {
            console.log(x11.y);
        } else {
            console.log(x11.y);
        }
    }
}

type funcType = () => number;
interface I_Optional_Func {
    y: number;
    x?: funcType;
}

export function accessOptionalFuncTypedField() {
    const i2: I_Optional_Func = { y: 1, x: undefined };
    const a = i2.x;
    console.log(a);
    // The following case not compile success yet, since we set vtable immutable
    // i2.x = () => 8;
    // console.log(i2.x());
}
