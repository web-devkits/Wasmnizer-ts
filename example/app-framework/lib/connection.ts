/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { i32, arraybuffer_to_string, string_to_arraybuffer } from './utils';
import { attr_container_get_serialize_length } from './attr_container';

// Wasmnizer-ts: @NativeSignature@ (i32, i32, i32)=>boolean
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

export const /* Data is received */
    CONN_EVENT_TYPE_DATA = 1,
    /* Connection is disconnected */
    CONN_EVENT_TYPE_DISCONNECT = 2;

export type on_connection_event_f = (
    conn: wamr_connection,
    type: number,
    data: string,
    len: number,
) => void;

export class wamr_connection {
    handle: i32;
    on_event: on_connection_event_f;

    constructor(handle: i32, on_event: on_connection_event_f) {
        this.handle = handle;
        this.on_event = on_event;
    }
}

const connection_list = new Array<wamr_connection>();

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
                conn.on_event(conn, CONN_EVENT_TYPE_DISCONNECT, '', len);
            } else {
                const buffer_str = arraybuffer_to_string(buffer, len);
                conn.on_event(conn, CONN_EVENT_TYPE_DATA, buffer_str, len);
            }
            return;
        }
    }
}
