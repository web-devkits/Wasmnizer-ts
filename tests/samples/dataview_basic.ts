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
    console.log(d.getInt8(2));
    d.setInt8(2, 5);
    console.log(d.getInt8(2));
}

export function dataViewI16() {
    const a = new ArrayBuffer(16);
    const d = new DataView(a, 3, 8);
    d.setInt16(2, 5, true);
    console.log(d.getInt8(2)); // 5
    console.log(d.getInt8(3)); // 0
    console.log(d.getInt16(2, true)); // 5
    console.log(d.getInt16(2)); // 1280
    d.setInt16(2, 5);
    console.log(d.getInt8(2)); // 0
    console.log(d.getInt8(3)); // 5
    console.log(d.getInt16(2, true)); // 1280
    console.log(d.getInt16(2, false)); // 5
}

// export function dataViewUI8() {
//     const a = new ArrayBuffer(1);
//     const d = new DataView(a, 0, 1);
//     d.setInt8(0, -5);
//     const a2 = d.buffer;
//     console.log(a2)
//     // console.log(d.getInt8(2)); // -5
//     // console.log(d.getUint8(2)); //251
//     // d.setUint8(2, -5);
//     // console.log(d.getInt8(2)); // -5
//     // console.log(d.getUint8(2)); // 251
// }

// export function dataViewUI16() {
//     const a = new ArrayBuffer(16);
//     const d = new DataView(a, 3, 8);
//     d.setInt16(2, -5);
//     console.log(d)
//     console.log(d.getInt8(2)); // 5
//     console.log(d.getInt8(3)); // 0
//     console.log(d.getInt16(2, true)); // 5
//     console.log(d.getInt16(2)); // 1280
//     // d.setInt16(2, -5);
//     // console.log(d.getInt8(2)); // 0
//     // console.log(d.getInt8(3)); // 5
//     // console.log(d.getInt16(2, true)); // 1280
//     // console.log(d.getInt16(2, false)); // 5
// }
