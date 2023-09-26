/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function nestedArray() {
    const array1: Array<number[]> = new Array<number[]>(1);
    array1[0] = [100];
    return array1[0][0];
}
