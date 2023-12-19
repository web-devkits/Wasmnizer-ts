/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const benchmark_dir = dirname(__filename);
const benchmarks = fs.readdirSync(benchmark_dir);
const ts2wasm_script = path.join(benchmark_dir, '../../build/cli/ts2wasm.js');
const iwasm_gc = path.join(benchmark_dir, '../../runtime-library/build/iwasm_gc');
const default_qjs = path.join(benchmark_dir, '../../runtime-library/deps/quickjs/qjs');
const wamrc = path.join(benchmark_dir, '../../runtime-library/deps/wamr-gc/wamr-compiler/build/wamrc');
const optimize_level = 3;
const validate_res_error = 'Validate result error';

function print_help() {
    console.log(`Usage: node run_benchmark.js [options]`);
    console.log(`Options:`);
    console.log(`  --no-clean=true|false`);
    console.log(`  --times=NUM`);
    console.log(`  --gc-heap=NUM`);
    console.log(`  --benchmarks=NAME1,NAME2,...`);
    console.log(`  --runtimes=NAME1,NAME2,...`);
    console.log(`  --help`);
    console.log(`Example:`);
    console.log(`  node run_benchmark.js --no-clean=true --times=10 --gc-heap=40960000 --benchmarks=mandelbrot,binarytrees_class --runtimes=wamr-interp,qjs`);
    process.exit(0);
}

function parseArguments(rawArgs) {
    const args = {};
    rawArgs.forEach(arg => {
        if (arg === '--help' || arg === 'help' || arg === 'h') {
            print_help();
        }
        const [key, value] = arg.split('=');
        args[key] = value;
    });
    return args;
}

const args = parseArguments(process.argv.slice(2));

const shouldClean = args['--no-clean'] ? false : true;
const multirun = args['--times'] ? parseInt(args['--times']) : 1;
const wamr_stack_size = args['--stack-size'] ? parseInt(args['--stack-size']) : 40960000;
const wamr_gc_heap = args['--gc-heap'] ? parseInt(args['--gc-heap']) : 40960000;
const specifed_benchmarks = args['--benchmarks'] ? args['--benchmarks'].split(',') : null;
const specified_runtimes = args['--runtimes'] ? args['--runtimes'].split(',') : null;

const default_gc_size_option = `--gc-heap-size=${wamr_gc_heap}`
const stack_size_option = `--stack-size=${wamr_stack_size}`

let qjs;
try {
    qjs = execSync('which qjs').toString().trim();
} catch (error) {
    if (process.env.QJS_PATH) {
        qjs = process.env.QJS_PATH;
    } else {
        const default_qjs_path = '/usr/local/bin/qjs';
        if (fs.existsSync(default_qjs_path)) {
            qjs = default_qjs_path;
        } else {
            if (fs.existsSync(default_qjs)) {
                qjs = default_qjs;
            }
            else {
                console.error("Error: QJS_PATH is not defined, and no default qjs path is provided.");
                process.exit(1);
            }
        }
    }
}

let ts_times = [];
let js_times = [];
let aot_times = [];
let prefixs = [];

let benchmark_options = {
    'merkletrees': {
        skip: true
    },
    'mandelbrot': {
        wamr_option: [default_gc_size_option]
    },
    'binarytrees_class': {
        wamr_option: [default_gc_size_option]
    },
    'binarytrees_interface': {
        wamr_option: [default_gc_size_option]
    },
    'quicksort': {
        wamr_option: [stack_size_option, default_gc_size_option]
    },
    'quicksort_float': {
        wamr_option: [stack_size_option, default_gc_size_option]
    },
}

function collect_benchmark_options(options) {
    if (options == undefined) {
        return '';
    }
    return options.join(' ');
}

console.log(`\x1b[33m======================== options ========================\x1b[0m`);
console.log(`QJS_PATH: ${qjs}`);
console.log(`strategy: run ${multirun} times and get average`);
console.log(`clean generated files: ${shouldClean ? 'true' : 'false'}`);
console.log(`\x1b[33m======================== running ========================\x1b[0m`);

function run_multiple_times(cmd) {
    let elapsed;
    let elapse_arr = [];

    try {
        for (let i = 0; i < multirun; i++) {
            let start = performance.now();
            let ret = execSync(cmd);
            let end = performance.now();
            elapsed = (end - start);
            elapse_arr.push(elapsed);
            ret = ret.toString().trim();
            if (ret.startsWith(validate_res_error)) {
                throw new Error(ret);
            }
        }
    }
    catch (e) {
        console.log('')
        if (e.status) {
            console.log(`\x1b[31mExit Code: ${e.status}\x1b[0m`);
        }
        console.log(`\x1b[31m${e.message}\x1b[0m`);
        if (e.stdout) {
            console.log(`\x1b[31m${e.stdout.toString()}\x1b[0m`);
        }
        process.exit(1);
    }

    elapsed = elapse_arr.reduce((a, b) => a + b, 0) / elapse_arr.length;
    return elapsed;
}

let executed_benchmarks = 0;
for (let benchmark of benchmarks) {
    let filename = path.basename(benchmark);
    let prefix = path.basename(filename, path.extname(filename));
    let extension = path.extname(filename).slice(1);
    let js_file = `${prefix}.js`;
    let elapsed;

    if (extension != 'ts')
        continue;

    if (!fs.existsSync(`${prefix}.js`))
        continue;

    if (benchmark_options[prefix]?.skip) {
        console.log(`\x1b[33mSkip ${prefix} benchmark.\x1b[0m`);
        continue;
    }

    if (specifed_benchmarks && !specifed_benchmarks.includes(prefix)) {
        console.log(`\x1b[33mSkip ${prefix} benchmark due to argument filter.\x1b[0m`);
        continue;
    }

    console.log(`\x1b[36m################### ${prefix} ###################\x1b[0m`);
    prefixs.push(prefix);

    console.log(`Compiling ${prefix} benchmark:`);
    execSync(`node ${ts2wasm_script} ${filename} --opt ${optimize_level} --output ${prefix}.wasm > tmp.txt`);
    execSync(`${wamrc} --enable-gc -o ${prefix}.aot ${prefix}.wasm > tmp.txt`);

    if (specified_runtimes && !specified_runtimes.includes('wamr-interp')) {
        console.log(`\x1b[33mSkip WAMR interpreter due to argument filter.\x1b[0m`);
    }
    else {
        process.stdout.write(`WAMR interpreter ... \t`);
        elapsed = run_multiple_times(`${iwasm_gc} ${collect_benchmark_options(benchmark_options[prefix]?.wamr_option)} -f main ${prefix}.wasm`);
        ts_times.push(elapsed);
        console.log(`${elapsed.toFixed(2)}ms`);
    }

    if (specified_runtimes && !specified_runtimes.includes('wamr-aot')) {
        console.log(`\x1b[33mSkip WAMR AoT due to argument filter.\x1b[0m`);
    }
    else {
        process.stdout.write(`WAMR AoT ... \t\t`);
        elapsed = run_multiple_times(`${iwasm_gc} ${collect_benchmark_options(benchmark_options[prefix]?.wamr_option)} -f main ${prefix}.aot`);
        aot_times.push(elapsed);
        console.log(`${elapsed.toFixed(2)}ms`);
    }

    if (specified_runtimes && !specified_runtimes.includes('qjs')) {
        console.log(`\x1b[33mSkip QuickJS due to argument filter.\x1b[0m`);
    }
    else {
        process.stdout.write(`QuickJS ... \t\t`);
        elapsed = run_multiple_times(`${qjs} ${js_file}`);
        js_times.push(elapsed);
        console.log(`${elapsed.toFixed(2)}ms`);
    }

    executed_benchmarks++;
}

if (shouldClean) {
    execSync(`rm -f *.wasm`);
    execSync(`rm -f *.aot`);
    execSync(`rm -f tmp.txt`);
}

console.log(`\x1b[32m====================== results ======================\x1b[0m`);
let results = [];

for (let i = 0; i < executed_benchmarks; i++) {
    let ts_time = ts_times[i];
    let js_time = js_times[i];
    let aot_time = aot_times[i];

    let r = {
        benchmark: prefixs[i]
    }

    if (ts_time) {
        r['WAMR_interpreter'] = ts_time.toFixed(2) + 'ms';
    }

    if (aot_time) {
        r['WAMR_aot'] = aot_time.toFixed(2) + 'ms';
    }

    if (js_time) {
        r['QuickJS'] = js_time.toFixed(2) + 'ms';
    }

    if (ts_time && js_time) {
        let ratio = ts_time / js_time;
        let formatted_result = ratio.toFixed(2);
        r['WAMR_interpreter/qjs'] = formatted_result;
    }

    if (aot_time && js_time) {
        let ratio_aot = aot_time / js_time;
        let formatted_result_aot = ratio_aot.toFixed(2);
        r['WAMR_aot/qjs'] = formatted_result_aot;
    }

    results.push(r);
}

console.table(results);
