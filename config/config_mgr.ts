/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export interface ConfigMgr {
    opt: number;
    disableAny: boolean;
    disableBuiltIn: boolean;
    disableInterface: boolean;
    isBuiltIn: boolean;
    debug: boolean;
    sourceMap: boolean;
    enableException: boolean;
    enableStringRef: boolean;
    entry: string;
}

const defaultConfig: ConfigMgr = {
    opt: 0,
    disableAny: false,
    disableBuiltIn: false,
    disableInterface: false,
    isBuiltIn: false,
    debug: false,
    sourceMap: false,
    enableException: false,
    enableStringRef: false,
    entry: '_start',
};

let currentConfig: ConfigMgr = { ...defaultConfig };

export function setConfig(config: Partial<ConfigMgr>): void {
    currentConfig = { ...currentConfig, ...config };
}

export function getConfig(): ConfigMgr {
    return currentConfig;
}
