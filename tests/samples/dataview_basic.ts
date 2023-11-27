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

export function newDataView() {
    const a = new ArrayBuffer(10);
    const d1 = new DataView(a);
    d1.setInt8(0, 5);
    console.log(d1.getInt8(0));
    const d2 = new DataView(a, 5);
    d2.setInt8(0, -5);
    console.log(d2.getInt8(0));
    /* TODO: wasmType not ready */
    // console.log(d1.byteLength);
    // console.log(d1.byteOffset);
    // console.log(d2.byteLength);
    // console.log(d2.byteOffset);
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

export function dataViewF32() {
    const a = new ArrayBuffer(16);
    const d = new DataView(a, 0, 8);
    d.setFloat32(0, 2.25, true);
    console.log(d.getInt32(0, true)); // 1074790400
    console.log(d.getFloat32(0, true)); // 2.25
    d.setFloat32(0, -0.75, true);
    console.log(d.getInt32(0, true)); // -1086324736
    console.log(d.getFloat32(0, true)); // -0.75
}

export function dataViewF64() {
    const a = new ArrayBuffer(16);
    const d = new DataView(a, 0, 8);
    d.setFloat64(0, 2.25, true);
    console.log(d.getInt32(0, true)); // 0
    console.log(d.getFloat32(0, true)); // 0
    console.log(d.getFloat64(0, true)); // 2.25
    d.setFloat64(0, -0.75);
    console.log(d.getInt32(0)); // -1075314688
    console.log(d.getFloat32(0)); // -1.8125
    console.log(d.getFloat64(0)); // -0.75
}
