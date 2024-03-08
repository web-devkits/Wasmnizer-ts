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

export function main() {
    const size = 1e7;
    const expect = 99999970000002;
    let res = 0;
    const f = new Foo(0);

    for (let i = 0; i < size; i++) {
        res += f.x;
        res += f.bar();
        f.x = i;
    }
    if (res !== expect) {
        console.log('Validate result error in class access');
    }
    return res;
}
