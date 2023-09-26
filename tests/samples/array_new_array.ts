/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */
export function implElemType() {
    const a: number[] = new Array(3);
    a[1] = 10;
    const b = new Array(1, 2);
    return a[1] + b[1];
}
