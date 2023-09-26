/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function immediateResolveWithNoArg() {
    const promiseInst: any = Promise.resolve();
    promiseInst.then(
        (value: any) => {
            console.log('then_onFulfilled_func');
        },
        (reason: any) => {
            console.log('then_onRejected_func');
        },
    );
}

export function immediateResolveWithArg() {
    const promiseInst: any = Promise.resolve();
    promiseInst.then(
        (param: any) => {
            console.log('then_onFulfilled_func');
        },
        (param: any) => {
            console.log('then_onRejected_func');
        },
    );
}

export function immediateReject() {
    Promise.reject().then(
        (value: any) => {
            console.log('then_onFulfilled_func');
        },
        (reason: any) => {
            console.log('then_onRejected_func');
        },
    );
}
