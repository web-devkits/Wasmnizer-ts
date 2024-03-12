/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface Foo {
    x: number;
    z?: boolean;
    bar(val: number): number;
}

class Bar {
    x: number;
    z?: boolean;
    bar(val: number) {
        this.x = val;
        return this.x;
    }
    constructor(x: number) {
        this.x = x;
    }
}

export function main() {
    const size = 1e6;
    const expect = 499999500000;
    const f: Foo = new Bar(0);
    let res = 0;

    for (let i = 0; i < size; i++) {
        res += f.bar(i);
    }
    if (res !== expect) {
        console.log(
            'Validate result error in interface access method (fast path)',
        );
    }
    return res;
}
