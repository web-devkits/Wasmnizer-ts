/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const benchmark_dir = dirname(__filename);
const benchmarks = fs.readdirSync(benchmark_dir);
const compile_output_dir = path.join(benchmark_dir, 'compile_output');
const ts2wasm_script = path.join(benchmark_dir, '../../build/cli/ts2wasm.js');
const optimize_level = 3;

let tsc_cmd;
try {
    tsc_cmd = execSync('which tsc').toString().trim();
} catch (error) {
    if (process.env.TSC_PATH) {
        tsc_cmd = process.env.TSC_PATH;
    } else {
        const default_tsc_path = '/usr/local/bin/tsc';
        if (fs.existsSync(default_tsc_path)) {
            tsc_cmd = default_tsc_path;
        } else {
            console.error("Error: TSC_PATH is not defined, and no default node path is provided.");
            process.exit(1);
        }
    }
}

console.log(`\x1b[33m======================== options ========================\x1b[0m`);
console.log(`TSC_PATH: ${tsc_cmd}`);
console.log(`\x1b[33m======================== compiling ========================\x1b[0m`);

for (let benchmark of benchmarks) {
    let filename = path.basename(benchmark);
    let prefix = path.basename(filename, path.extname(filename));
    let extension = path.extname(filename).slice(1);

    if (extension != 'ts')
        continue;

    fs.mkdirSync(compile_output_dir, { recursive: true }, (err) => {
        if (err) {
            console.error(`Failed to create ${compile_output_dir}:`, err);
        }
    })

    console.log(`Compiling ${prefix} benchmark: `);
    execSync(`node ${ts2wasm_script} ${filename} --opt ${optimize_level} --output ${compile_output_dir}/${prefix}.wasm > tmp.txt`);
    console.log(`    wasm target success`);
    execSync(`${tsc_cmd} ${filename} --outDir ${compile_output_dir} -m esnext`);
    console.log(`    js target success`);
}

execSync(`rm -f tmp.txt`);
