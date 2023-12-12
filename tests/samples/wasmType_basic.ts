/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function wasmTypeAssign() {
    /* assignment */
    let i32Value: i32 = 132;
    let i64Value: i64 = 164;
    let f32Value: f32 = 232.25252525;
    let f64Value: f64 = 264.75757575;
    let anyValue: anyref = 'hi';
    console.log(i32Value);
    console.log(i64Value);
    console.log(f32Value);
    console.log(f64Value);
    console.log(anyValue);
}

export function toI32Value() {
    let i32Value: i32 = 132;
    let i64Value: i64 = 164;
    let f32Value: f32 = 232.25252525;
    let f64Value: f64 = 264.75757575;
    /* convert to i32 */
    i32Value = i64Value;
    console.log(i32Value);
    i32Value = f32Value;
    console.log(i32Value);
    i32Value = f64Value;
    console.log(i32Value);
}

export function toI64Value() {
    let i32Value: i32 = 132;
    let i64Value: i64 = 164;
    let f32Value: f32 = 232.25252525;
    let f64Value: f64 = 264.75757575;
    /* convert to i64 */
    i64Value = i32Value;
    console.log(i64Value);
    i64Value = f32Value;
    console.log(i64Value);
    i64Value = f64Value;
    console.log(i64Value);
}

export function toF32Value() {
    let i32Value: i32 = 132;
    let i64Value: i64 = 164;
    let f32Value: f32 = 232.25252525;
    let f64Value: f64 = 264.75757575;
    /* convert to f32 */
    f32Value = i32Value;
    console.log(f32Value);
    f32Value = i64Value;
    console.log(f32Value);
    f32Value = f64Value;
    console.log(f32Value);
}

export function toF64Value() {
    let i32Value: i32 = 132;
    let i64Value: i64 = 164;
    let f32Value: f32 = 232.32;
    let f64Value: f64 = 264.64;
    /* convert to f64 */
    f64Value = i32Value;
    console.log(f64Value);
    f64Value = i64Value;
    console.log(f64Value);
    f64Value = f32Value;
    console.log(f64Value);
}

export function anyConvertValue() {
    let anyValue: anyref = 'hi';
    console.log(anyValue);
    let f32Value: f32 = 900;
    anyValue = f32Value;
    console.log(f32Value);
    console.log(anyValue);
    anyValue = 800;
    f32Value = anyValue;
    console.log(f32Value);
    console.log(anyValue);
}

export function optimizeLiteralValue() {
    const i32Value: i32 = 100;
    console.log(i32Value);
    const i64Value: i64 = 100;
    console.log(i64Value);
    const f32Value: f32 = 100;
    console.log(f32Value);
    const f64Value: f64 = 100;
    console.log(f64Value);
}

export function operateWasmTypeAndLiteral() {
    let i32Value: i32 = 10;
    let i64Value: i64 = 20;
    let f32Value: f32 = 30.50;
    let f64Value: f64 = 40.550;
    
    const res0 = i32Value + 100;
    const res1 = i32Value + 100.80;
    const res2 = i64Value + 100;
    const res3 = i64Value + 100.80;
    const res4 = f32Value + 100;
    const res5 = f32Value + 100.80;
    const res6 = f64Value + 100;
    const res7 = f64Value + 100.80;

    console.log(res0)
    console.log(res1)
    console.log(res2)
    console.log(res3)
    console.log(res4)
    console.log(res5)
    console.log(res6)
    console.log(res7)
}

export function operateWasmTypeAndWasmType() {
    let i32Value: i32 = 10;
    let i64Value: i64 = 20;
    let f32Value: f32 = 30.50;
    let f64Value: f64 = 40.5550;
    
    const res0 = i32Value + i32Value;
    const res1 = i32Value + i64Value;
    const res2 = i32Value + f32Value;
    const res3 = i32Value + f64Value;

    const res4 = i64Value + i32Value;
    const res5 = i64Value + i64Value;
    const res6 = i64Value + f32Value;
    const res7 = i64Value + f64Value;

    const res8 = f32Value + i32Value;
    const res9 = f32Value + i64Value;
    const res10 = f32Value + f32Value;
    const res11 = f32Value + f64Value;

    const res12 = f64Value + i32Value;
    const res13 = f64Value + i64Value;
    const res14 = f64Value + f32Value;
    const res15 = f64Value + f64Value;

    console.log(res0)
    console.log(res1)
    console.log(res2)
    console.log(res3)
    console.log(res4)
    console.log(res5)
    console.log(res6)
    console.log(res7)
    console.log(res8)
    console.log(res9)
    console.log(res10)
    console.log(res11)
    console.log(res12)
    console.log(res13)
    console.log(res14)
    console.log(res15)
}

export function wasmTypeCompare() {
    let a: i64 = 0;
    if (a < 100) {
        console.log(a);
    }
}

export function wasmTypeUnaryExpr() {
    let a: i64 = 0;
    a++;
    console.log(a);
    --a;
    console.log(a);
    if (!a) {
        console.log('hi');
    } else {
        console.log('hello');
    }
}