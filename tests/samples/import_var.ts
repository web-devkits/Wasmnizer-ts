/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as vars from './export_var';

export function importVarA() {
    return vars.aVar;
}

export function importVarB() {
    return vars.bVar;
}

export function importVarC() {
    return vars.c;
}
