/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function tuple_type() {
    const a: [i32, f32] = [10, 20.5];
    const b: [[i32, f32], string] = [a, 'hi'];
    console.log(b[0][0]);
    console.log(b[0][1]);
    console.log(b[1]);
}