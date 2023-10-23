/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    [key: string]: number;
}

interface I_FUNC {
    [key: string]: () => number;
}

export function infc_obj_get_field() {
    const obj: I = {
        x: 1,
        y: 2,
    };
    for (const key in obj) {
        console.log(obj[key]);
    }
}

export function infc_obj_set_field() {
    const obj: I = {
        x: 1,
        y: 2,
    };
    for (const key in obj) {
        obj[key] = 100;
        console.log(obj[key]);
    }
}

/* TODO: assignment between funcref and closureref
export function infc_obj_get_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
    };
    for (const key in obj) {
        const a = obj[key];
        console.log(a());
    }
}

export function infc_obj_set_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
    };
    for (const key in obj) {
        obj[key] = () => 100;
        const a = obj[key];
        console.log(a());
    }
}
*/
