/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { importObject, setWasmMemory } from './import_object.js';

export function run_wasm_module(wasmFilePath, wasmFuncName, ...funcArgs) {
    fetch(wasmFilePath)
        .then((response) => response.arrayBuffer())
        .then((bytes) => WebAssembly.instantiate(bytes, importObject))
        .then((results) => {
            const exports = results.instance.exports;
            setWasmMemory(exports.default);
            const startFunc = exports._entry;
            startFunc();
            const exportedFunc = exports[wasmFuncName];
            const res = exportedFunc(...funcArgs);
            if (typeof res !== 'object' || res === null) {
                const resultElement = document.getElementById('result');
                resultElement.innerHTML = `The result is: ${res}`;
            }
        });
}