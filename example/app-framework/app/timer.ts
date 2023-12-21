/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as timer from '../lib/timer';

let cnt = 0;

export function on_init(): void {
    /* The callback function will be called every 2 second,
        and will stop after 10 calls */
    const my_timer = timer.setInterval((my_timer) => {
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
