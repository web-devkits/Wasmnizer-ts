/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export type i32 = number;

export function arraybuffer_to_string(
    buffer: ArrayBuffer,
    buffer_length: number,
) {
    const codes: number[] = new Array(buffer_length);
    const dataview = new DataView(buffer);
    for (let i = 0; i < buffer_length; i++) {
        codes[i] = dataview.getUint8(i);
    }
    return String.fromCharCode(...codes);
}

export function string_to_arraybuffer(url: string) {
    const url_length = url.length;
    const arraybuffer = new ArrayBuffer(url_length);
    const dataview = new DataView(arraybuffer);
    for (let i = 0; i < url_length; i++) {
        dataview.setUint8(i, url.charCodeAt(i));
    }
    return arraybuffer;
}
