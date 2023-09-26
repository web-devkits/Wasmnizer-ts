/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { C_var } from './module_start_C';
import { B_var } from './module_start_B';

export let A_var = 1000;
A_var = A_var + B_var + C_var;

export function getAVar() {
    return A_var;
}

export function getBVar() {
    return B_var;
}

export function getCVar() {
    return C_var;
}
