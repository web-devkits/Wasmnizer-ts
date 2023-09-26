/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    func1(...data: any[]): number {
        return 100;
    }
}

export function test() {
    const a: A = new A();
    const ret = a.func1(1, 2);
    console.log(ret);
}
