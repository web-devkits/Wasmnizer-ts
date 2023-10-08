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

type ItemGenerator<T, U> = (item: T, index?: U) => void

function func1<T, U>(func: ItemGenerator<T, U>, a: T, b: U) {
    func(a, b);
}

function func2<T, U>(func: ItemGenerator<U, T>, a: T, b: U) {
    func(b, a);
}

export function typeFunc() {
    const itemGenerator1: ItemGenerator<boolean, number> = (item: boolean, index?: number) => {console.log(item)};
    func1<boolean, number>(itemGenerator1, true, 444);

    const itemGenerator2: ItemGenerator<string, boolean> = (item: string, index?: boolean) => {console.log(index)};
    func2<boolean, string>(itemGenerator2, false, 'hello');
}