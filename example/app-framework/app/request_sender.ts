/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as request from '../lib/request';
import { arraybuffer_to_string, string_to_arraybuffer } from '../lib/utils';

export function on_init(): void {
    const payload = string_to_arraybuffer('hello, handler');
    request.post('/test', payload, payload.byteLength, '', (resp) => {
        if (resp != null) {
            console.log('Post Success');

            if (resp.payload != null) {
                console.log('    response payload:');
                const resp_payload_string = arraybuffer_to_string(
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
