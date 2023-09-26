/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function oriExportFunc() {
    return 10;
}

function exportFunc() {
    return 20;
}

const oriExportVar = 100;
const exportVar = 200;

class OriExportClass {
    field = 50;
    getField() {
        return this.field;
    }
}

class ExportClass {
    field = 600;
    getField() {
        return this.field;
    }
}

namespace oriExportNS {
    export function aFunc() {
        return 88;
    }
}

namespace exportNS {
    export function aFunc() {
        return 66;
    }
}

export {
    oriExportFunc as exportFunc,
    oriExportVar as exportVar,
    OriExportClass as ExportClass,
    oriExportNS as exportNS,
};
