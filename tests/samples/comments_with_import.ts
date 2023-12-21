/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

// Wasmnizer-ts: @Export@ nameF
// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>i32
export declare function nameE(arrayBuffer: ArrayBuffer, length: i32): i32;

// Wasmnizer-ts: @Import@ wamr, nameH
// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>void
declare function nameG(buffer: ArrayBuffer, size: i32): void;

export function callDeclare() {
    const a = new ArrayBuffer(10);
    nameG(a, 10);
}
