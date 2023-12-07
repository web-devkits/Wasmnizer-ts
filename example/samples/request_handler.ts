/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

// The entry file of your WebAssembly module.
import * as timer from '../app-framework/timer';
import * as request from '../app-framework/request';

type i32 = number;

export function on_init(): void {
    request.register_resource_handler('/test', (req) => {
        const payload_string = request.arraybuffer_to_string(
            req.payload,
            req.payload_len,
        );

        console.log('### Req: /test  ' + payload_string);
        console.log('    request payload:');
        console.log('    ' + payload_string + '\n');

        const resp = request.make_response_for_request(req);
        resp.set_payload(request.string_to_arraybuffer('OK'), 2);
        request.api_response_send(resp);
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
