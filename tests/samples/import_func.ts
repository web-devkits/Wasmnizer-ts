/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import defaultFunction, {
    addFunc as add,
    sub,
    mulFunc as mul,
    divFunc as divFunc,
} from './export_func';

import { exportedFunc } from './export_func_invoked';

import {testLog}  from './export_from/libA/index'

export function importFuncAdd() {
    const a = add(1, 2);
    return a;
}

export function importFuncSub() {
    const a = sub(1, 2);
    return a;
}

export function importFuncMul() {
    const a = mul(1, 2);
    return a;
}

export function importFuncDiv() {
    const a = divFunc(4, 2);
    return a;
}

export function importDefaultFunc() {
    return defaultFunction();
}

export function importFuncInvoked() {
    const importedFunc = exportedFunc;
    return importedFunc();
}


export function importFuncByExportFrom(){
    testLog();
}