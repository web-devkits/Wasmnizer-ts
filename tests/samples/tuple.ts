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

export function tuple_as_array_elem() {
    const tuple1: [i32, string] = [1, 'hi_1'];
    const tuple2: [i32, string] = [2, 'hi_2'];
    const tuple3: [i32, string] = [3, 'hi_3'];
    const array: [i32, string][] = [tuple1, tuple2, tuple3];
    console.log(array[0][1]);
    console.log(array[1][1]);
    console.log(array[2][1]);
}

export function tuple_as_obj_field() {
    const tuple1: [i32, string] = [1, 'hi_1'];
    const tuple2: [i32, string] = [2, 'hi_2'];
    const tuple3: [i32, string] = [3, 'hi_3'];
    const obj = {
        a: tuple1 as [i32, string],
        b: tuple2 as [i32, string],
        c: tuple3 as [i32, string],
    }
    
    console.log(obj.a[1]);
    console.log(obj.b[1]);
    console.log(obj.c[1]);
}

interface T {
    x: [i32, string],
    y: [number, string],
}

export function tuple_as_infc_field() {
    const tuple1: [i32, string] = [1, 'hi_1'];
    const tuple2: [number, string] = [2, 'hi_2'];
    const obj: T = {
        x: tuple1 as [i32, string],
        y: tuple2,
    }
    /* TODO: tuple box to any & unbox from any is not ready */
    // console.log(obj.x[1]);
    // console.log(obj.y[1]);
}

export function tuple_with_array() {
    const array1: i32[] = [1, 2, 3];
    const array2: string[] = ['hi_1', 'hi_2', 'hi_3'];
    const tuple: [i32[], string[]] = [array1, array2];
    console.log(tuple[0][1]);
    console.log(tuple[1][1]);
}

class A {
    a: i64 = 1;
    b: string = 'hi_1';
}

class B {
    a: i64 = 2;
    b: string = 'hi_2';
}

export function tuple_with_class() {
    const a_instance = new A();
    const b_instance = new B();
    const tuple: [A, B] = [a_instance, b_instance];
    console.log(tuple[0].a);
    console.log(tuple[1].b);
}

export function tuple_with_infc() {
    const tuple1: [i32, string] = [1, 'hi_1'];
    const tuple2: [number, string] = [2, 'hi_2'];
    const obj: T = {
        x: tuple1 as [i32, string],
        y: tuple2,
    }
    const tuple: [T] = [obj];
    /* TODO: tuple box to any & unbox from any is not ready */
    // console.log(tuple[0].x[0]);
}
