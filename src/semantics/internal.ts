/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function getClassMetaName(name: string): string {
    return `@${name}`;
}

function getClassPrototypeName(name: string): string {
    return `@_proto_${name}`;
}

export const InternalNames = {
    CONSTRUCTOR: 'constructor',
    CALLBACK: '@callback',
    NEW: '@new',
    getClassMetaName,
    getClassPrototypeName,
};
