/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function staticStringAdd() {
    const a = "hello";
    const b = "world";
    const c = a + b;
    console.log(c);
}

export function dynStringAdd() {
    const a: any = "hello";
    const b: any = "world";
    const c = a + b;
    console.log(c);
}

export function staticDynStringAdd() {
    const a: any = "hello";
    const b = "world";
    const c = a + b;
    console.log(c);
}

export function staticToStringAdd() {
    const a = "hello";
    const b1 = 123;
    const c1 = a + b1;
    console.log(c1);
    const b2 = true;
    const c2 = a + b2;
    console.log(c2);
}

export function dynToStringAdd() {
    const a: any = "hello";
    const b1: any = 123;
    const c1 = a + b1;
    console.log(c1);
    const b2: any = true;
    const c2: any = a + b2;
    console.log(c2);
}
