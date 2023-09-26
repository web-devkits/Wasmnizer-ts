/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

enum Color2 {
    RED,
    GREEN,
    BLUE,
    WHITE = "white"
}

enum Color1 {
    RED = 'red',
    GREEN = 'green',
    BLUE = 'blue',
    WHITE = 0,
}

export function digitEnum() {
    let red: Color2 = Color2.RED;
    if (red === Color2.RED) {
        console.log(red);
    }
}

export function stringEnum() {
    let red: Color1 = Color1.RED;
    if (red === Color1.RED) {
        console.log(red);
    }
}

