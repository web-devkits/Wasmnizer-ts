/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export interface DumpWriter {
    write(str: string): void;
    shift(): void;
    unshift(): void;
}

export function CreateDefaultDumpWriter(): DumpWriter {
    let prefix = '';
    return {
        write: (s: string) => console.log(`${prefix}${s}`),
        shift: () => (prefix = prefix + '\t'),
        unshift: () => (prefix = prefix.slice(1)),
    };
}
