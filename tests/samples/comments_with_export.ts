/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { nameANotInEntry } from "./comments_not_entry";

// Wasmnizer-ts: @Export@ nameB
export function nameA() {
    console.log('exportName is nameB');
}

// Wasmnizer-ts: @Export@ nameD
// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>void
export function nameC(arrayBuffer: ArrayBuffer, length: i32) {
    console.log('exportName is nameD');
}
