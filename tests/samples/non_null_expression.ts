/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

/* Write some test cases to cover TypeScript non-null expression */

type funcT = (x: number) => number;

export function test_non_null_func() {
    let fn : funcT | null;

    fn = (x: number) => {
        return x * 2;
    }

    return fn!(2); // 4
}


export function test_non_null_field() {
    let obj = {
        a: 1,
        b: 2,
        c: {
            d: 3,
            e: {
                f: 4
            }
        }
    }

    return obj!.c!.e!.f; // 4
}


export function test_non_null_any() {
    let obj: any = {
        a: 1,
        b: 2,
        c: {
            d: 3,
            e: {
                f: 4
            }
        }
    }

    console.log(obj!.c!.e!.f);  // 4
    console.log(obj!.x!);   // undefined
}

