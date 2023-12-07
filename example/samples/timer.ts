/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

// The entry file of your WebAssembly module.
import * as timer from '../app-framework/timer';

/* clousure is not implemented yet, we need to declare global variables
    so that they can be accessed inside a callback function */
let cnt = 0;
let my_timer: timer.user_timer;
type i32 = number;

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

/* Function below are requred by wamr runtime, don't remove or modify them */
export function _on_timer_callback(on_timer_id: i32): void {
    timer.on_timer_callback(on_timer_id);
}
