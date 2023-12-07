/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as timer from '../app-framework/timer';
import * as request from '../app-framework/request';

type i32 = number;

export function on_init(): void {
    const payload = request.string_to_arraybuffer('test message');
    request.post('/test', payload, payload.byteLength, '', (resp) => {
        if (resp != null) {
            console.log('Post Success');

            if (resp.payload != null) {
                console.log('    response payload:');
                const resp_payload_string = request.arraybuffer_to_string(
                    resp.payload,
                    resp.payload_len,
                );
                console.log('    ' + resp_payload_string + '\n');
            }
        } else console.log('Post Timeout');
    });
}

export function on_destroy(): void {
    // on destory actions
}

/* Function below are requred by wamr runtime, don't remove or modify them */
export function _on_timer_callback(on_timer_id: i32): void {
    timer.on_timer_callback(on_timer_id);
}

// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>void
export function _on_request(buffer_offset: ArrayBuffer, size: i32): void {
    request.on_request(buffer_offset, size);
}

// Wasmnizer-ts: @NativeSignature@ (i32, i32)=>void
export function _on_response(buffer_offset: ArrayBuffer, size: i32): void {
    request.on_response(buffer_offset, size);
}
