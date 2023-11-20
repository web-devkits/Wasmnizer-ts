/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function getdataViewProperty() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 5);
    /* TODO: wasmType not ready */
    // console.log(d.byteLength);
    // console.log(d.byteOffset);
}

export function dataViewI8() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 5);
    console.log(d.getInt8(2))
    d.setInt8(2, 5);
    console.log(d.getInt8(2))
}
