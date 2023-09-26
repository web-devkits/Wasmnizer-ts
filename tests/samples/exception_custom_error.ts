/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class AError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export function throwCustomError() {
    let a = 1;
    try {
        a += 1;
        throw new AError('throw custom error A');
    } catch (error) {
        a += 2;
    }
    return a;
}
