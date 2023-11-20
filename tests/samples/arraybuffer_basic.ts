/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function getArrayBufferLength() {
    const a = new ArrayBuffer(10);
    const length = a.slice(0, 1);
    /* TODO: wasmType not ready */
    // console.log(length);
}

export function arrayBufferIsView() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 5);
    console.log(ArrayBuffer.isView(a));
    console.log(ArrayBuffer.isView(d));
}
