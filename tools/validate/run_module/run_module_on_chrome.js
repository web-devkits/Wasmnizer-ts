/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { importObject, setWasmMemory } from './import_object.js';

export function run_wasm_module(filePath, funcName, warmupTimes, runTarget, ...funcArgs) {
    const parts = filePath.split(".");
    const extension = parts[parts.length - 1];
    if (runTarget === 'js') {
        if (extension !== 'js') {
            const resultElement = document.getElementById('result');
            resultElement.innerHTML = `Error: filePath must end with ".js`;
        }
        fetch(filePath)
        .then(response => response.text())
        .then(script => {
            if (warmupTimes) {
                for (let i = 0; i < parseInt(warmupTimes); i++) {
                    eval(script);
                }
            }
            const start_time = performance.now();
            let res = eval(script);
            if (funcName) {
                res = window[funcName](...funcArgs);
            }
            const end_time = performance.now();
            if (typeof res !== 'object' || res === null) {
                const resultElement = document.getElementById('result');
                resultElement.innerHTML = `The result is: ${res}`;
            }
            const timeElement = document.getElementById('time');
            timeElement.innerHTML = `Execution time is: ${end_time - start_time}`;
        });
    } else if (runTarget === 'wasm') {
        if (extension !== 'wasm') {
            const resultElement = document.getElementById('result');
            resultElement.innerHTML = `Error: filePath must end with ".wasm`;
        }
        fetch(filePath)
        .then((response) => response.arrayBuffer())
        .then((bytes) => WebAssembly.instantiate(bytes, importObject))
        .then((results) => {
            const exports = results.instance.exports;
            setWasmMemory(exports.default);
            const startFunc = exports._entry;
            const exportedFunc = exports[funcName];
            if (warmupTimes) {
                for (let i = 0; i < parseInt(warmupTimes); i++) {
                    startFunc();
                    exportedFunc(...funcArgs);
                }
            }
            const start_time = performance.now();
            startFunc();
            const res = exportedFunc(...funcArgs);
            const end_time = performance.now();
            if (typeof res !== 'object' || res === null) {
                const resultElement = document.getElementById('result');
                resultElement.innerHTML = `The result is: ${res}`;
            }
            const timeElement = document.getElementById('time');
            timeElement.innerHTML = `Execution time is: ${end_time - start_time}`;
        });
    }
}