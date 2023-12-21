/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as request from '../lib/request';
import { arraybuffer_to_string, string_to_arraybuffer } from '../lib/utils';

export function on_init(): void {
    request.register_resource_handler('/test', (req) => {
        const payload_string = arraybuffer_to_string(
            req.payload,
            req.payload_len,
        );

        console.log('### Req: /test  ' + payload_string);
        console.log('    request payload:');
        console.log('    ' + payload_string + '\n');

        const resp = request.make_response_for_request(req);
        resp.set_payload(string_to_arraybuffer('OK'), 2);
        request.api_response_send(resp);
    });
}

export function on_destroy(): void {
    // on destory actions
}
