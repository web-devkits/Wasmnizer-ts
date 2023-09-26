/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function test() {
    function inner_func<T>(value: T) {
        console.log("call inner function");
        return value;
    }

    let number_tmp = inner_func(2023);
    console.log(number_tmp);

    let string_tmp = inner_func("hello world");
    console.log(string_tmp);
}
