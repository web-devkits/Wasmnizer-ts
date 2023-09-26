/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function newPromiseWithVoid() {
    const promiseInst: any = new Promise<void>((resolve: any, reject: any) => {
        console.log('before call resolve')
        resolve();
        console.log('after call resolve');
    });

    promiseInst
    .then((data: any) => {
        console.log('then_onFulfilled_func');
    });
}

export function newPromiseWithNumber() {
    const promiseInst: any = new Promise<number>((resolve: any, reject: any) => {
        resolve(100);
    });

    promiseInst
    .then((value: any) => {
        console.log(value);
    });
}

export function newPromiseWithString() {
    const promiseInst: any = new Promise<string>((resolve: any, reject: any) => {
        resolve('hello');
    });

    promiseInst
    .then((value: any) => {
        console.log(value);
    });
}
