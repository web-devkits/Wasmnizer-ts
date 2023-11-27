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