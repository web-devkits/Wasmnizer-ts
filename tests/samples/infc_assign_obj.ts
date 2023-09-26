/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface I {
    x: number;
    y: boolean;
}

/** interface will a substitution field */
interface I1 {
    x: {};
}

export function objLiteralAndInfc() {
    const i: I = { x: 1, y: false };
    let o = { x: 10, y: true };
    o = i;
    return o.x;
}

interface RouteInfo {
    package: string;
    path: string;
    value: number;
}

const route: RouteInfo = {
    path: '',
    package: '',
    value: 12,
};

export function infcInitGlobal() {
    return route.value;
}
