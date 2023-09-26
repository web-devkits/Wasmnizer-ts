/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function percentToken() {
    console.log(10 % 3);  // 1
    console.log(-10 % 3); // -1
    console.log(-3 % 10); // -3
    return -3 % 10;       // -3:f64
}