/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function genericFunc<T>(param: T): T {
    return param;
}

function genericArrayFunc<T>(param: T): T[] {
    return [param];
}

export function numberFunc() {
    console.log(genericFunc(100));
}

export function booleanFunc() {
    console.log(genericFunc(true));
}

export function stringFunc() {
    console.log(genericFunc('hello'));
}

export function stringArrayFunc() {
    console.log(genericArrayFunc('hi')[0]);
}
