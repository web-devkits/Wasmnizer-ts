/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function test(a?: string) {
    if (a) {
        let b: string = a as string;
        console.log(b)
    }
}

export function any_as_string() {
    test('hello world');  // hello world
}
