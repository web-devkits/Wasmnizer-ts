/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function initNumberWithBinary() {
    let value = 0b00101;    // 5
    console.log(value);

    value = 0B001010;        // 10
    console.log(value);
}

export function initNumberWithOctal() {
    let value = 0O000171;   // 64 + 56 + 1 = 121
    console.log(value);

    value = 0o0001710;       // 968
    console.log(value);
}

export function initNumberWithHex() {
    let value = 0x00AF1;    // 10 * 16^2 + 15 * 16 + 1 = 2801
    console.log(value);

    value = 0X00AF0;        // 2800
    console.log(value);

    value = 0X00af0;        // 2800
    console.log(value);     
}