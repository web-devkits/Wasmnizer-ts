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
    console.log(obj['x']);
}

export function infc_obj_set_field() {
    const obj: I = {
        x: 1,
        y: 2,
    };
    obj['x'] = 100;
    console.log(obj['x']);
}

export function obj_get_field() {
    const obj = {
        x: 1,
        y: 2,
    };
    console.log(obj['x']);
}

export function obj_set_field() {
    const obj = {
        x: 1,
        y: 2,
    };
    obj['x'] = 100;
    console.log(obj['x']);
}

export function obj_get_method() {
    const obj = {
        x: () => 1,
        y: () => 2,
    };
    const a = obj['x'];
    console.log(a());
}

export interface I1 {
    [key: string]: any;
}
export type T1 = (params?: I1) => void;
export interface I2 {
    [key: string]: T1;
}

export function infc_obj_get_instance_method() {
    const obj: I2 = {
        a: (params?: I1) => {
            console.log('hi');
        },
    };
    const a = obj['a'];
    a();
}

export function infc_obj_get_vtable_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
        hello() {
            return 5;
        }
    };
    const a = obj['hello'];
    console.log(a());
}

export function infc_obj_set_method() {
    const obj: I_FUNC = {
        x: () => 1,
        y: () => 2,
    };
    obj['x'] = () => 100;
    const a = obj['x'];
    console.log(a());
}

export function obj_set_method() {
    const obj = {
        x: () => 1,
        y: () => 2,
    };
    obj['x'] = () => 100;
    const a = obj['x'];
    console.log(a());
}

