/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function tuple_type_with_constant() {
    const a: [i32, f32] = [10, 20.5];
    const b: [[i32, f32], string] = [a, 'hi'];
    console.log(b[0][0]);
    console.log(b[0][1]);
    console.log(b[1]);
}

export function tuple_type_with_variable() {
    const aaa = { a: 10 };
    type tupleType = [any, string, i32];
    const tupleInstance: tupleType = [aaa, 'hi', 90];
    for (let i = 0; i < tupleInstance.length; i++) {
        const field = tupleInstance[i];
        console.log(field);
    }
}

export function tuple_type_nested() {
    type tupleType = [string, [i32, boolean, [i64, [f32, any]]]];

    const tupleInstance: tupleType = ['hi', [10, true, [20, [30, 'hello']]]];
    const a_idx = 1;
    const b_idx = 2;
    const c_idx = 0;
    /* TODO: tuple box to any & unbox from any is not ready */
    // return tupleInstance[a_idx][b_idx][c_idx];
}

function tuple_as_param_inner(tuple: [i32, string]) {
    console.log(tuple[0]);
    console.log(tuple[1]);
}

export function tuple_as_param() {
    const param: [i32, string] = [30, 'hi'];
    tuple_as_param_inner(param);
}

interface I {
    a: i32
}

function tuple_as_ret_inner(): [I, i64] {
    const obj:I = {
        a: 10 as i32
    }
    const tuple: [I, i64] = [obj, 100]
    return tuple;
}

export function tuple_as_ret() {
    const tuple: [I, i64] = tuple_as_ret_inner();
    const obj = tuple[0];
    console.log(obj.a);
    console.log(tuple[1]);
}