/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as connection from '../app-framework/connection';
import * as timer from '../app-framework/timer';
import * as request from '../app-framework/request';
import {
    arraybuffer_to_string,
    string_to_arraybuffer,
} from '../app-framework/utils';

let my_timer: timer.user_timer;

export function on_init(): void {
    const str = 'this is client!';
    request.register_resource_handler('/close', (req) => {
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
    // TODO
}

export function on_destroy(): void {
    // on destory actions
}
