/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import { assert } from 'console';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import Long from 'long';

function i64New(lowBits: number, highBits: number) {
    return Long.fromBits(lowBits, highBits);
}

function i64Add(leftI64: Long, rightI64: Long) {
    return leftI64.add(rightI64);
}

function i64Align(i64Value: Long, alignment: number) {
    const maskNumber = alignment - 1;
    assert(alignment && (alignment & maskNumber) == 0);
    const i64Mask = Long.fromInt(maskNumber);
    return i64Value.add(i64Mask).and(i64Mask.not());
}

export function initGlobalOffset(module: binaryen.Module, usedMemory: number) {
    let memoryOffset = i64New(usedMemory, 0);
    // add global dataEnd
    module.addGlobal(
        BuiltinNames.dataEnd,
        binaryen.i32,
        false,
        module.i32.const(memoryOffset.low),
    );
    module.addGlobalExport(BuiltinNames.dataEnd, BuiltinNames.dataEnd);

    memoryOffset = i64Align(
        i64Add(memoryOffset, i64New(BuiltinNames.stackSize, 0)),
        Math.ceil(BuiltinNames.byteSize / 8),
    );
    // add global stackPointer
    module.addGlobal(
        BuiltinNames.stackPointer,
        binaryen.i32,
        true,
        module.i32.const(memoryOffset.low),
    );
    // add global heapBase
    module.addGlobal(
        BuiltinNames.heapBase,
        binaryen.i32,
        false,
        module.i32.const(memoryOffset.low),
    );
    module.addGlobalExport(BuiltinNames.heapBase, BuiltinNames.heapBase);
}

export const memoryAlignment = 4;

export function initDefaultMemory(
    module: binaryen.Module,
    segments: binaryen.MemorySegment[],
): void {
    module.setMemory(
        BuiltinNames.memInitialPages,
        BuiltinNames.memMaximumPages,
        'default',
        segments,
    );
}

export function initDefaultTable(module: binaryen.Module): void {
    module.addTable(BuiltinNames.extrefTable, 0, -1, binaryen.anyref);
}
