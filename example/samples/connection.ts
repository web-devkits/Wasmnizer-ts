/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as connection from '../app-framework/connection';
import * as timer from '../app-framework/timer';
import * as request from '../app-framework/request';
import * as attr_container from '../app-framework/attr_container';
import {
    i32,
    arraybuffer_to_string,
    string_to_arraybuffer,
} from '../app-framework/utils';

let my_timer: timer.user_timer;
const num = 0;
let g_conn: connection.wamr_connection | null;

function on_data1(
    conn: connection.wamr_connection,
    type: connection.conn_event_type_t,
    data: string,
    len: i32,
) {
    if (type == connection.conn_event_type_t.CONN_EVENT_TYPE_DATA) {
        const message = data;
        console.log('Client got a message from server ->' + message);
    } else if (
        type == connection.conn_event_type_t.CONN_EVENT_TYPE_DISCONNECT
    ) {
        console.log('connection is close by server!');
    } else {
        console.log('error: got unknown event type!!!');
    }
}

function timer1_update(timer: timer.user_timer) {
    const message = 'Hello, ' + num;
    connection.send_on_connection(g_conn!, message, message.length);
}

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

    let args = attr_container.attr_container_create('');
    let isSuccess = attr_container.attr_container_set_string(
        args,
        'address',
        '127.0.0.1',
    );
    if (isSuccess) {
        args = attr_container.global_attr_cont;
    }
    isSuccess = attr_container.attr_container_set_uint16(args, 'port', 7777);
    if (isSuccess) {
        args = attr_container.global_attr_cont;
    }

    g_conn = connection.open_connection('TCP', args, on_data1);
    if (g_conn == null) {
        console.log('connect to server fail!');
        return;
    }

    console.log('connect to server success!');
}

export function on_destroy(): void {
    // on destory actions
}
