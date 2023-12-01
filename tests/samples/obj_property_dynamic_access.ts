/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class PropClass {
    field: number = 100;
}
interface I1 {
    a: number;
    foo: ()=>number;
    prop: PropClass;
}

interface I2 {
    a: any;
    foo: any;
    prop: any;
}

export function dynamicGetUnboxingInObjLiteral() {
    const x: any = 1;
    const y: any = ()=>1;
    const z: any = new PropClass();
    const obj: I1 = {
        a: x,
        foo: y,
        prop: z,
    };
    const a = obj.a;
    console.log(a);
    const foo_invoke = obj.foo();
    console.log(foo_invoke);
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

export function dynamicGetBoxingInObjLiteral() {
    const obj: I2 = {
        a: 8,
        foo: ()=>8,
        prop: new PropClass(),
    };
    const a = obj.a;
    console.log(a);
    const foo = obj.foo;
    const foo_invoke = foo();
    console.log(foo_invoke);
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

class A1 {
    a: any = 10;
    foo: any = ()=>1;
    prop: any = new PropClass();
}

class A2 {
    a: number = 10;
    foo = ()=>1;
    prop = new PropClass();
}

export function dynamicGetUnboxingInClass() {
    const obj: I1 = new A1();
    const a = obj.a;
    console.log(a);
    const foo = obj.foo;
    const foo_invoke = foo();
    console.log(foo_invoke);
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

export function dynamicGetBoxingInClass() {
    const obj: I2 = new A2();
    const a = obj.a;
    console.log(a);
    const foo = obj.foo;
    const foo_invoke = foo();
    console.log(foo_invoke);
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

export function dynamicSetUnboxingInClass() {
    const obj: I1 = new A1();
    let value: any = 5;
    obj.a = value;
    console.log(obj.a);
    // The following case not compile success yet, since we set vtable immutable
    // value = ()=>5;
    // obj.foo = value;
    // const foo = obj.foo;
    // const foo_invoke = foo();
    // console.log(foo_invoke);
    value = new PropClass();
    obj.prop = value;
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

export function dynamicSetBoxingInClass() {
    const obj: I2 = new A2();
    const value1 = 5;
    const a = obj.a;
    console.log(a);
    // The following case not compile success yet, since we set vtable immutable
    // const foo = obj.foo;
    // const foo_invoke = foo();
    // console.log(foo_invoke);
    const value2 = new PropClass();
    const prop_field = obj.prop.field;
    console.log(prop_field);
}

interface I3 {
    x?: number | string;
}
class A3 {
    x: number | string | undefined = 6;
}

export function dynamicAccessInUnionType() {
    const obj: I3 = new A3();
    const value2 = 11;
    obj.x = value2;
    const bbb = obj.x;
    console.log(bbb);
}
