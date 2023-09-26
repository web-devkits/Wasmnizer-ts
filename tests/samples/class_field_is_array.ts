/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class ParamsObject {
    key = '123';
    val = '';
}

class RouteInfo {
    params: Array<ParamsObject> = [];
}

export function test() {
    let route: RouteInfo = new RouteInfo();
    route.params.push(new ParamsObject());
    const a = route.params[0];
}