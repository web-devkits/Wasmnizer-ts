/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function NonEffectWasmType() {
    let nnn: number = 1;
    let nn2: i64 = 2;

    class A {
        field: number;

        constructor() {
            this.field = 1;
        }
    }

    console.log(nnn);
}

export function wasmTypeInClass() {
    let a: i32 = 10;
    let b: i64 = 20;
    let c: f32 = 30.50;
    let d: f64 = 40.450;

    class A {
        field1: i32;
        field2: i64;
        field3: f32;
        field4: f64;

        constructor() {
            this.field1 = 1;
            this.field2 = 2;
            this.field3 = 3.5;
            this.field4 = 5.5;
        }
    }

    const instance = new A();
    console.log(instance.field1);
    console.log(instance.field2);
    console.log(instance.field3);
    console.log(instance.field4);

    instance.field1 = a;
    instance.field2 = b;
    instance.field3 = c;
    instance.field4 = d;
    console.log(instance.field1);
    console.log(instance.field2);
    console.log(instance.field3);
    console.log(instance.field4);
}

export function wasmTypeInObj() {
    let a: i32 = 10;
    let b: i64 = 20;
    let c: f32 = 30.50;
    let d: f64 = 40.450;

    interface IA{
        field1: i32;
        field2: i64;
        field3: f32;
        field4: f64;
    }

    const ia : IA = {
        field1 : 1 as i32,
        field2 : 2 as i64,
        field3 : 3.5 as f32,
        field4 : 5.5 as f64,
    };
    console.log(ia.field1);
    console.log(ia.field2);
    console.log(ia.field3);
    console.log(ia.field4);

    ia.field1 = a;
    ia.field2 = b;
    ia.field3 = c;
    ia.field4 = d;
    console.log(ia.field1);
    console.log(ia.field2);
    console.log(ia.field3);
    console.log(ia.field4);
}

export function wasmTypeInArray() {
    const arr1: i32[] = [];
    const tmpI32Value: i32 = 1;
    arr1.push(tmpI32Value);
    arr1.push(10);
    arr1.push(12.75);
    console.log(arr1[0]);
    console.log(arr1[1]);
    console.log(arr1[2]);

    const arr2: i64[] = [];
    arr2.push(2);
    arr2.push(5.89);
    console.log(arr2[0]);
    console.log(arr2[1]);

    const arr3: f32[] = [1, 2.987];
    arr3.push(2);
    arr3.push(5.89);
    console.log(arr3[0]);
    console.log(arr3[1]);
    console.log(arr3[2]);
    console.log(arr3[3]);

    const arr4: f64[] = [1, 2.987];
    arr4.push(2);
    arr4.push(5.89);
    console.log(arr4[0]);
    console.log(arr4[1]);
    console.log(arr4[2]);
    console.log(arr4[3]);

    const arr5: anyref[] = [];
    arr5.push(2);
    arr5.push(3.5);
    arr5.push('hi');
    console.log(arr5[0]);
    console.log(arr5[1]);
    console.log(arr5[2]);
}

export function wasmTypeAs() {
    const a = 100.78;
    const b: i32 = a as i32;
    const c: i64 = a as i64;
    const d: f32 = a as f32;
    const e: f64 = a as f64;
    console.log(b);
    console.log(c);
    console.log(d);
    console.log(e);
}

export function wasmTypeI32AsReturnType(): i32 {
    return 100.25;
}

export function wasmTypeI64AsReturnType(): i64 {
    return 100.25;
}

export function wasmTypeF32AsReturnType(): f32 {
    return 100.25;
}

export function wasmTypeF64AsReturnType(): f64 {
    return 100.25;
}