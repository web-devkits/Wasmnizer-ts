/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function string_or() {
    const str1: string = ''
    const newStr1: string = str1 || "hello"
    console.log(newStr1) // hello

    const str2: string = 'wasm'
    const newStr2: string = str2 || "hello"
    console.log(newStr2) // wasm
}