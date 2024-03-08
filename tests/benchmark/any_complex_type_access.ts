/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class Foo {
    x = 0;
    y = false;
}

export function main() {
    const val: any = new Foo();
    val.z = 0;
    const size = 4e5;
    let res = 0;
    const expect = 159998800002;
    for (let i = 0; i < size; i++) {
        res += val.x;
        val.x = i;
        res += val.z;
        val.z = i;
    }
    if (res !== expect) {
        console.log('Validate result error in any type access (complex type)');
    }
    return res;
}
