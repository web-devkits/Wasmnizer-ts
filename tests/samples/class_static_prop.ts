/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A15 {
    static test() {
        return 1;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}
}

class B15 extends A15 {
    constructor() {
        super();
    }
    static test() {
        return 2;
    }
}
export function staticMethodWithOverwrite() {
    return B15.test();
}

export class A16 {
    static hi() {
        return 1;
    }
}

export function staticMethod() {
    return A16.hi();
}

class A {
    static c = 10; //10
    static readonly d = 12 + A.c; //22
}

class B extends A {
    static c = 20; // 20 20
}
export function staticFields() {
    return A.c + A.d + B.c + B.d;
}

/* extends static fields */
export class A1 {
    static field1: string = 'field1'
    static field2: string = 'field2'
    static field3: string = 'field3'
    static field4: string = 'field4'
}

export class A2  extends A1 {
    static field5: string = 'field5'
    static field6: string = 'field5'
}

/* overwrite static fields */
export class A3 {
    static field1: string = 'field1'
    static field2: string = 'field2'
    static field3: string = 'field3'
    static field4: string = 'field4'
}

export class A4  extends A2 {
    static field1: string = 'field5'
    static field2: string = 'field5'
}


export class staticFieldsInit {
    static field1: number = 0
    static field2: number = 1
    static field3: number = 2
}

export function testStaticField1() {
    return staticFieldsInit.field1; // 0
}

export function testStaticField2() {
    return staticFieldsInit.field2; // 1
}

export function testStaticField3() {
    return staticFieldsInit.field3; // 2
}

class Circle {
    pi: number = 100;
    static pi: number = 3.14;

    calculateArea(radius:number):number {
        // this function has no practical meaning, just for testing.
        return this.pi * Circle.pi * radius;
    }

    static calculateArea(radius:number) {
        return Circle.pi * radius * radius;
    }
}
export function staticFieldWithOverwrite() {
    console.log(Circle.pi);
    console.log(Circle.calculateArea(1));

    const circle = new Circle();
    console.log(circle.pi);
    console.log(circle.calculateArea(1));
}
