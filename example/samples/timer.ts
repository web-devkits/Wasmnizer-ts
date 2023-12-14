/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as timer from '../app-framework/timer';

/* To use variables in the callback function:
    1. set variables as global variables.
    2. use closure.
   Here, we take 1.
 */
let cnt = 0;
let my_timer: timer.user_timer;

export function on_init(): void {
    /* The callback function will be called every 2 second,
        and will stop after 10 calls */
    my_timer = timer.setInterval(() => {
        cnt++;
        console.log((cnt * 2).toString() + ' seconds passed');

        if (cnt >= 10) {
            timer.timer_cancel(my_timer);
            console.log('Stop Timer');
        }
    }, 2000);
}

export function on_destroy(): void {
    // on destory actions
}
