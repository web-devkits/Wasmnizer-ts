/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function throwNewError() {
    throw new Error('A new error');
}

export function throwError() {
    throw Error('An error');
}
