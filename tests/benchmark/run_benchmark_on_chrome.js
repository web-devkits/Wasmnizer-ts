/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { importObject, setWasmMemory } from '../../tools/validate/run_module/import_object.js';

const compile_output_dir = './compile_output/';

export async function run_wasm_file(fileName, warmupTimes, runTimes) {
    return fetch(compile_output_dir.concat(fileName, '.wasm'))
        .then((response) => response.arrayBuffer())
        .then((bytes) => WebAssembly.instantiate(bytes, importObject))
        .then((results) => {
            const exports = results.instance.exports;
            setWasmMemory(exports.default);
            const startFunc = exports._entry;
            const funcName = 'main';
            const exportedFunc = exports[funcName];
            startFunc();
            if (warmupTimes) {
                for (let i = 0; i < parseInt(warmupTimes); i++) {
                    exportedFunc();
                }
            }
            let run_time_total = 0;
            if (!runTimes) {
                runTimes = 1;
            }
            for (let i = 0; i < parseInt(runTimes); i++) {
                const start_time = performance.now();
                const res = exportedFunc();
                const end_time = performance.now();
                run_time_total += end_time - start_time;
                if (typeof res !== 'object' || res === null) {
                    console.log(`${fileName}.wasm result is : ${res}`);
                } else {
                    console.log(`${fileName}.wasm result is object`);
                }
            }
            const run_time_average = run_time_total / runTimes;
            const cell1 = document.getElementById(`${fileName}_1`);
            cell1.textContent = run_time_average.toFixed(2);
            const cell2_value = document.getElementById(`${fileName}_2`).textContent;
            const cell3 = document.getElementById(`${fileName}_3`);
            cell3.textContent = (run_time_average / cell2_value).toFixed(2);
        })
        .catch((error)=> {
            console.error(`${fileName}.wasm occurs error`);
        })
}
