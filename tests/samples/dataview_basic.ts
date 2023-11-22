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
    console.log(d.getInt8(2)); // 0
    d.setInt8(2, 5);
    console.log(d.getInt8(2)); // 5
    d.setInt8(2, -5);
    console.log(d.getInt8(2)); // -5
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
    d.setInt16(2, -5, true);
    console.log(d.getInt8(2)); // -5
    console.log(d.getInt8(3)); // -1
    console.log(d.getInt16(2, true)); // -5
    console.log(d.getInt16(2)); // -1025
    d.setInt16(2, -5);
    console.log(d.getInt8(2)); // -1
    console.log(d.getInt8(3)); // -5
    console.log(d.getInt16(2, true)); // -1025
    console.log(d.getInt16(2, false)); // -5
}

export function dataViewI32() {
    const a = new ArrayBuffer(16);
    const d = new DataView(a, 3, 8);
    d.setInt32(2, 5, true);
    console.log(d.getInt16(2, true)); // 5
    console.log(d.getInt16(2)); // 1280
    console.log(d.getInt32(2, true)); // 5
    console.log(d.getInt32(2)); // 83886080
    d.setInt32(2, 5);
    console.log(d.getInt16(2, true)); // 0
    console.log(d.getInt16(2)); // 0
    console.log(d.getInt32(2, true)); // 83886080
    console.log(d.getInt32(2)); // 5
    d.setInt32(2, -5, true);
    console.log(d.getInt16(2, true)); // -5
    console.log(d.getInt16(2)); // -1025
    console.log(d.getInt32(2, true)); // -5
    console.log(d.getInt32(2)); // -67108865
    d.setInt32(2, -5);
    console.log(d.getInt16(2, true)); // -1
    console.log(d.getInt16(2)); // -1
    console.log(d.getInt32(2, true)); // -67108865
    console.log(d.getInt32(2)); // -5
}

export function dataViewUi8() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 5);
    d.setUint8(2, 5);
    console.log(d.getInt8(2)); // 5
    console.log(d.getUint8(2)); // 5
    d.setUint8(2, -5);
    console.log(d.getInt8(2)); // -5
    console.log(d.getUint8(2)); // 251
    d.setInt8(2, 5);
    console.log(d.getInt8(2)); // 5
    console.log(d.getUint8(2)); // 5
    d.setInt8(2, -5);
    console.log(d.getInt8(2)); // -5
    console.log(d.getUint8(2)); // 251
}

export function dataViewUi16() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 5);
    d.setUint16(2, 5);
    console.log(d.getInt16(2)); // 5
    console.log(d.getUint16(2)); // 5
    d.setUint16(2, -5);
    console.log(d.getInt16(2)); // -5
    console.log(d.getUint16(2)); // 65531
    d.setInt16(2, 5);
    console.log(d.getInt16(2)); // 5
    console.log(d.getUint16(2)); // 5
    d.setInt16(2, -5);
    console.log(d.getInt16(2)); // -5
    console.log(d.getUint16(2)); // 65531
}

export function dataViewUi32() {
    const a = new ArrayBuffer(10);
    const d = new DataView(a, 1, 8);
    d.setUint32(2, 5);
    console.log(d.getInt32(2)); // 5
    console.log(d.getUint32(2)); // 5
    d.setUint32(2, -5);
    console.log(d.getInt32(2)); // -5
    console.log(d.getUint32(2)); // 4294967291
    d.setInt32(2, 5);
    console.log(d.getInt32(2)); // 5
    console.log(d.getUint32(2)); // 5
    d.setInt32(2, -5);
    console.log(d.getInt32(2)); // -5
    console.log(d.getUint32(2)); // 4294967291
}
