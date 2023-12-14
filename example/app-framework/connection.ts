/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { i32, arraybuffer_to_string, string_to_arraybuffer } from './utils';

// Wasmnizer-ts: @NativeSignature@ (string, i32, i32)=>boolean
declare function wasm_open_connection(
    name: string,
    args_buf: ArrayBuffer,
    args_buf_len: i32,
): i32;
declare function wasm_close_connection(handle: i32): void;
// Wasmnizer-ts: @NativeSignature@ (i32, i32, i32)=>boolean
declare function wasm_send_on_connection(
    handle: i32,
    data: ArrayBuffer,
    data_len: i32,
): i32;
// Wasmnizer-ts: @NativeSignature@ (i32, i32, i32)=>boolean
declare function wasm_config_connection(
    handle: i32,
    cfg_buf: ArrayBuffer,
    cfg_buf_len: i32,
): i32;

enum conn_event_type_t {
    /* Data is received */
    CONN_EVENT_TYPE_DATA = 1,
    /* Connection is disconnected */
    CONN_EVENT_TYPE_DISCONNECT,
}

type on_connection_event_f = (
    conn: wamr_connection,
    type: conn_event_type_t,
    data: string,
    len: i32,
) => void;

class wamr_connection {
    handle: i32;
    on_event: on_connection_event_f;

    constructor(handle: i32, on_event: on_connection_event_f) {
        this.handle = handle;
        this.on_event = on_event;
    }
}

const connection_list = new Array<wamr_connection>();

export function attr_container_create(tag: string) {
    const tag_length = tag.length + 1;
    const offset_of_buf = 2;
    const length = offset_of_buf + 4 + 2 + tag_length + 100;

    const attr_buffer = new ArrayBuffer(length);
    const dataview = new DataView(attr_buffer);
    for (let i = 0; i < length; i++) {
        dataview.setUint8(i, 0);
    }
    let offset = offset_of_buf;
    dataview.setUint32(offset, length - offset_of_buf);
    offset += 4;
    dataview.setUint16(offset, tag_length);
    offset += 2;
    for (let i = 0; i < tag.length; i++) {
        dataview.setUint8(i + offset, tag.charCodeAt(i));
    }
    return attr_buffer;
}

export function attr_container_get_serialize_length(args: ArrayBuffer): i32 {
    const dataview = new DataView(args);
    const buf_value = dataview.getUint8(2);
    return 2 + buf_value;
}

export function open_connection(
    name: string,
    args: ArrayBuffer,
    on_event: on_connection_event_f,
): wamr_connection | null {
    const args_len: i32 = attr_container_get_serialize_length(args);
    const handle = wasm_open_connection(name, args, args_len);
    if (handle === -1) {
        return null;
    }
    const conn = new wamr_connection(handle, on_event);
    connection_list.push(conn);
    return conn;
}

export function close_connection(c: wamr_connection) {
    for (let i = 0; i < connection_list.length; i++) {
        if (connection_list[i] === c) {
            wasm_close_connection(c.handle);
            connection_list.splice(i, 1);
            return;
        }
    }
}

export function send_on_connection(
    conn: wamr_connection,
    data: string,
    len: i32,
) {
    const data_buffer = string_to_arraybuffer(data);
    return wasm_send_on_connection(conn.handle, data_buffer, len);
}

export function config_connection(conn: wamr_connection, cfg: ArrayBuffer) {
    const cfg_len: i32 = attr_container_get_serialize_length(cfg);
    return wasm_config_connection(conn.handle, cfg, cfg_len);
}

// Wasmnizer-ts: @NativeSignature@ (i32, i32, i32)=>void
// Wasmnizer-ts: @Export@ _on_connection_data
export function on_connection_data(handle: i32, buffer: ArrayBuffer, len: i32) {
    for (let i = 0; i < connection_list.length; i++) {
        const conn = connection_list[i];
        if (conn.handle === handle) {
            if (len === 0) {
                conn.on_event(
                    conn,
                    conn_event_type_t.CONN_EVENT_TYPE_DISCONNECT,
                    '',
                    len,
                );
            } else {
                const buffer_str = arraybuffer_to_string(buffer, len);
                conn.on_event(
                    conn,
                    conn_event_type_t.CONN_EVENT_TYPE_DATA,
                    buffer_str,
                    len,
                );
            }
            return;
        }
    }
}
