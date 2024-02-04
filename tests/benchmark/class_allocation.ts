/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class Foo {
    x: number;
    bar() {
        return this.x;
    }
    constructor(x: number) {
        this.x = x;
    }
}

const size = 1e7;
const len = 10;

const arr = new Array<Foo>(len);
export function main() {
    for (let i = 0, j = 0; i < size; i++, j++) {
        if (j >= len) j = 0;
        arr[j] = new Foo(i);
    }
    return arr;
}
