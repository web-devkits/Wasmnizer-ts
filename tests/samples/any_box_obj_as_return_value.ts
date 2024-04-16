/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function getAnyObj(): any {
    return { a: 1 };
}

export function getObjPropFromReturnValue() {
    const obj: any = getAnyObj();
    console.log(obj.a);
}
