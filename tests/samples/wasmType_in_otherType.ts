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
    // const arr2: i64[] = [];
    // const arr3: f32[] = [];
    // const arr4: f64[] = [];
    // const arr5: anyref[] = [];

    // const tmp: i32 = 1;
    // arr1.push(tmp);
    // arr2.push(2);
    // arr3.push(3.5);
    // arr4.push(4.5);
    // arr5.push('hi');
    
    // console.log(arr1[0]);

    // TODO: nest array cast
    // const arr1_nest: i32[][] = [[]];
    // const arr2_nest: i64[][] = [[]];
    // const arr3_nest: f32[][] = [[]];
    // const arr4_nest: f64[][] = [[]];
    // const arr5_nest: anyref[][] = [[]];

    // arr1_nest.push(arr1);
    // console.log(arr1_nest[0][0]);
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
