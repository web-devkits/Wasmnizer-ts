/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function unionTypeAssign(){
    const a: number|string = 100;
    let res: number|string;
    res = a; 
    return res as number;
}
