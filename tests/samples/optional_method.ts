/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export type FuncType = () => void;
export interface I1 {
    [key: string]: FuncType | undefined;
}

function innerFunc(obj: I1, funcName: string) {
    const fn = obj[funcName];
    if (fn != undefined) {
        fn();
    } else {
        console.log('fn is undefined');
    }
}

export function optionalMethod() {
    const obj1: I1 = {
        foo: undefined,
        bar: () => {
            console.log('fn is bar');
        },
    };
    innerFunc(obj1, 'foo');
    innerFunc(obj1, 'bar');

    const obj2: I1 = {
        x: undefined,
    };
    innerFunc(obj2, 'foo');
    innerFunc(obj2, 'bar');
}
