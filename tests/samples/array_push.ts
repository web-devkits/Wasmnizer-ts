/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_push_number() {
    let array1: number[] = [1, 2];
    let length: number = array1.push(3, 4);
    return length;
}

export function array_push_number_with_empty() {
    const a: number[] = [];
    a.push(10);
    return a[0];
}

class ParamsObject {
    key = '123';
    val = '';
}

class RouteInfo {
    params: Array<ParamsObject> = [];
}

export function array_class2() {
    let route: RouteInfo = new RouteInfo();
    route.params.push(new ParamsObject());
    console.log(route.params[0].key);
    route.params = new Array<ParamsObject>();
    route.params.push(new ParamsObject());
    console.log(route.params[0].key);
}

export function array_push_boolean() {
    let array1: boolean[] = [true, false];
    let length: number = array1.push(true, false);
    return length;
}

export function array_push_string() {
    let array1: string[] = ['hello', 'world'];
    let length: number = array1.push('hello', 'world');
    return length;
}

class A {
    x: string = 'xxx'
}

class B extends A {
    y: number = 1
}

export function array_push_class() {
    let array1: A[] = [new A(), new A()];
    let b : A = new B();
    let length: number = array1.push(new A(), new A(), b);
    return length;
}

interface I {
    x: string
}

export function array_push_interface() {
    let array1: I[] = [{ x: '' }, { x: '' }];
    let obj = new B();
    let i : I = obj;
    let length = array1.push(i);
    return length;
}

export function array_push_number_array() {
    let array: Array<Array<number>> = [[1, 2, 3], [4, 3, 5]];
    let length = array.push([2, 5, 2], [44, 2]);
    return length;
}

export function array_push_string_array() {
    let array: Array<Array<string>> = [['h', 'sl'], ['world']];
    let length = array.push(['123']);
    console.log(array[2][0]);
    return length;
}
