/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function NonEffectWasmType() {
    let nnn: number = 1;
    let nn2: i64 = 2;

    class A {
        field: number;

        constructor() {
            this.field = 1;
        }
    }

    console.log(nnn);
}
