/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

// Wasmnizer-ts: @Export@ nameB
export function nameA() {
    console.log('exportName is nameB');
}

// Wasmnizer-ts: @Export@ nameD
// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>void
export function nameC(arrayBuffer: ArrayBuffer, length: i32) {
    console.log('exportName is nameD');
}

// Wasmnizer-ts: @Export@ nameF
// Wasmnizer-ts: @NativeSignature@ (ArrayBuffer, i32)=>i32
export function nameE(arrayBuffer: i32, length: i32): i32 {
    return 1;
}

// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>i32
declare function nameG(buffer: ArrayBuffer, size: i32): void;

export function callDeclare() {
    const a = new ArrayBuffer(10);
    nameG(a, 10);
}
