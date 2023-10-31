/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I1 {
    a: number;
}

interface I2 {
    a: any;
}

export function dynamic_get_unboxing() {
    const x: any = 1;
    const obj: I1 = {
        a: x,
    };
    const a = obj.a;
    console.log(a);
}

export function dynamic_get_boxing() {
    const obj: I2 = {
        a: 8,
    };
    const a = obj.a;
    console.log(a);
}