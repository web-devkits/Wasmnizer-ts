/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    exportFunc as aliasFunc,
    exportVar as aliasVar,
    ExportClass as AliasClass,
    exportNS as aliasNS,
} from './export_alias_identifier';

export {
    aliasFunc as oriExportFunc,
    aliasVar as oriExportVar,
    AliasClass as OriExportClass,
    aliasNS as oriExportNS,
};
