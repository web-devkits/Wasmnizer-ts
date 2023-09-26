/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import * as T from './export_alias_identifier';

export function getAliasFunc() {
    return T.exportFunc();
}

export function getAliasVar() {
    return T.exportVar;
}

export function getAliasClass() {
    return new T.ExportClass().getField();
}

export function getAliasNS() {
    return T.exportNS.aFunc();
}
