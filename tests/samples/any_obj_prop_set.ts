/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function setUnExistProp() {
    let obj: any = {};
    obj.a = 1;
    obj.length = 4;
    return obj.length as number;
}

export function setExistProp() {
    let obj: any = { a: 1 };
    obj.a = 2;
    return obj.a as number;
}
