/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function anyFunc(num: any) {
    console.log(num);
}

function genericFunc<T>(num: T) {
    anyFunc(num);
}

type ForCallback<T> = (item: T, index: number) => number

export function testGenericParam() {
    genericFunc('hi');

    const fn: ForCallback<number> = (item: number, index: number): number => {return item + index}
    anyFunc(fn(1, 2));
}