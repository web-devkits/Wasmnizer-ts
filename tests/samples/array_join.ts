/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_join_string() {
    let array: string[] = ['hello', 'wasm', 'hello', 'world'];
    let s1 = array.join('$');
    console.log(s1);        // hello$wasm$hello$world
    let s1_len = s1.length;
    console.log(s1_len);    // 22
    let s2 = array.join();
    console.log(s2);        // hello,wasm,hello,world
    let s2_len = s2.length;
    console.log(s2_len);    // 22
}