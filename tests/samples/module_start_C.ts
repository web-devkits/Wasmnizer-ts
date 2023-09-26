/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export let C_var = 10;

C_var += 10;

export function getCVar() {
    return C_var;
}
