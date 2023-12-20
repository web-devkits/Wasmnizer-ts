/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as connection from '../lib/connection';
import * as timer from '../lib/timer';
import * as request from '../lib/request';
import * as attr_container from '../lib/attr_container';

let num = 0;
let g_conn: connection.wamr_connection | null;

function timer1_update(my_timer: timer.user_timer) {
    const message = 'Hello, ' + num;
    num++;
    connection.send_on_connection(g_conn!, message, message.length);
}

export function on_init(): void {
    request.register_resource_handler('/close', (req) => {
        if (g_conn !== null) {
            timer.timer_cancel(my_timer);
            connection.close_connection(g_conn);
        }
        const resp = request.make_response_for_request(req);
        resp.set_response(request.CoAP_Status.DELETED_2_02, 0, null, 0);
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

    g_conn = connection.open_connection(
        'TCP',
        args,
        (conn, type, data, len) => {
            if (type == connection.CONN_EVENT_TYPE_DATA) {
                const message = data;
                console.log('Client got a message from server ->' + message);
            } else if (type == connection.CONN_EVENT_TYPE_DISCONNECT) {
                console.log('connection is close by server!');
            } else {
                console.log('error: got unknown event type!!!');
            }
        },
    );
    if (g_conn == null) {
        console.log('connect to server fail!');
        return;
    }

    console.log('connect to server success!');

    // const my_timer = new timer.user_timer(timer1_update, 1000, true);
    // timer.timer_restart(my_timer, 1000);
    const my_timer = timer.setInterval(timer1_update, 2000);
}

export function on_destroy(): void {
    // on destory actions
}
