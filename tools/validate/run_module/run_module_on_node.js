/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import fs from 'fs';
import minimist from 'minimist';
import { importObject, setWasmMemory } from './import_object.js';

function showHelp() {
    console.log(`Options:
        -f: specify the exported WASM function
        -s: call the _start function
        -h: show help message\n`);
}

const cliArgs = minimist(process.argv.slice(2));
if (cliArgs.help || cliArgs.h) {
    showHelp();
    process.exit(0);
}
if (cliArgs._.length === 0) {
    console.log('WASM module path is required');
    process.exit(1);
}

const modulePath = cliArgs._[0];
const funcName = cliArgs.f;
const needCallStart = cliArgs.s;
const args = cliArgs._.slice(1);

const wasmBuffer = fs.readFileSync(modulePath);

WebAssembly.instantiate(wasmBuffer, importObject).then((wasmModule) => {
    const exports = wasmModule.instance.exports;
    setWasmMemory(exports.default);

    const _start = exports._start;
    if (needCallStart || !funcName) {
        _start();
    }
    if (!funcName) {
        return;
    }
    const exportedFunc = exports[funcName];
    const res = exportedFunc(...args);
    console.log(res);
});
