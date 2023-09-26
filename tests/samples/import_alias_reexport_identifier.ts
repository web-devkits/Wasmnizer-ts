/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    oriExportFunc as exportFunc,
    oriExportVar as exportVar,
    OriExportClass as ExportClass,
    oriExportNS as exportNS,
} from './export_alias_imported_identifier';

export function getAliasFunc() {
    return exportFunc();
}

export function getAliasVar() {
    return exportVar;
}

export function getAliasClass() {
    return new ExportClass().getField();
}

export function getAliasNS() {
    return exportNS.aFunc();
}
