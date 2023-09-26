/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import minimist from 'minimist';
import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ParserContext } from '../src/frontend.js';
import log4js from 'log4js';
import { Logger, consoleLogger } from '../src/log.js';
import { Ts2wasmBackend } from '../src/backend/index.js';
import { WASMGen } from '../src/backend/binaryen/index.js';
import { default as logConfig } from '../config/log4js.js';
import { SyntaxError } from '../src/error.js';
import { DumpAST } from '../src/dump_ast.js';
import { ConfigMgr, setConfig } from '../config/config_mgr.js';

interface HelpMessageCategory {
    General: string[];
    Compile: string[];
    Output: string[];
    Validation: string[];
    Other: string[];
}

function isRegularFile(filePath: string) {
    fs.lstat(filePath, function (err, stats) {
        if (stats.isSymbolicLink() || stats.nlink > 1) {
            throw new Error(`${filePath} is not a regular file`);
        }
    });
}

function validateFilePath(filePath: string) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${filePath} not exist`);
    }
    isRegularFile(filePath);
}

function parseOptions() {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const optionPath = path.join(dirname, '..', '..', 'cli', 'options.json');
    validateFilePath(optionPath);
    const helpFile = fs.readFileSync(optionPath, 'utf8');
    const helpConfig = JSON.parse(helpFile);
    return helpConfig;
}

function showVersion() {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.join(dirname, '..', '..', 'package.json');
    validateFilePath(packagePath);
    const packageFile = fs.readFileSync(packagePath, 'utf8');
    const packageConfig = JSON.parse(packageFile);
    const version = packageConfig.version;
    console.log('Version ' + version);
    process.exit(0);
}

function showHelp(helpConfig: any) {
    const printOption = {
        indent: 4,
        padding: 28,
        eol: '\n',
    };
    const categories: HelpMessageCategory = {
        General: [],
        Compile: [],
        Output: [],
        Validation: [],
        Other: [],
    };

    Object.keys(helpConfig).forEach((commandKey) => {
        const helpMessage: string[] = [];
        const option = helpConfig[commandKey];
        let comment = '';
        while (comment.length < printOption.indent) {
            comment += ' ';
        }
        comment += '--' + commandKey;
        if (option.alias) {
            comment += ', -' + option.alias;
        }
        while (comment.length < printOption.padding) {
            comment += ' ';
        }
        comment += option.description;
        helpMessage.push(comment);
        if (option.category) {
            const categoryKey = <keyof HelpMessageCategory>option.category;
            categories[categoryKey].push(helpMessage[0]);
        } else {
            categories['Other'].push(helpMessage[0]);
        }
    });

    const optionMessage: string[] = [];
    Object.keys(categories).forEach((category) => {
        const categoryKey = <keyof HelpMessageCategory>category;
        optionMessage.push(
            printOption.eol + ' ' + categoryKey + printOption.eol,
        );
        optionMessage.push(categories[categoryKey].join(printOption.eol));
    });
    optionMessage.join(printOption.eol);

    const otherMessage = [
        'EXAMPLES\n',
        '  ' + 'node' + ' build/cli/ts2wasm.js' + ' --help',
        '  ' +
            'node' +
            ' build/cli/ts2wasm.js' +
            ' sample.ts' +
            ' --output' +
            ' sample.wasm',
        '  ' +
            'node' +
            ' build/cli/ts2wasm.js' +
            ' sample.ts' +
            ' --output' +
            ' sample.wasm' +
            ' --wat',
        '  ' +
            'node' +
            ' build/cli/ts2wasm.js' +
            ' sample.ts' +
            ' --output' +
            ' sample.wasm' +
            ' --validate' +
            ' functionName' +
            ' param1' +
            ' param2',
        '\n',
        'OPTIONS',
    ];
    const outMessage = otherMessage.concat(optionMessage);
    console.log(outMessage.join(printOption.eol));
    process.exit(0);
}

export function writeFile(filename: string, contents: any, baseDir = '.') {
    if (!contents) {
        throw new Error('content is not valid');
    }
    const dirPath = path.normalize(
        path.resolve(baseDir, path.dirname(filename)),
    );
    const filePath = path.normalize(
        path.join(dirPath, path.basename(filename)),
    );
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function getAbsolutePath(filename: string, baseDir = '') {
    const dirPath = path.normalize(
        path.resolve(baseDir, path.dirname(filename)),
    );
    const filePath = path.normalize(
        path.join(dirPath, path.basename(filename)),
    );
    return filePath;
}

function validateByWAMR(cmdArgs: string[]) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const iwasm = path.join(dirname, 'iwasm_gc');
    if (!fs.existsSync(iwasm)) {
        throw new Error('iwasm_gc exec file not exist');
    }

    const result = cp.execFileSync(iwasm, cmdArgs).toString();
    console.log('WebAssembly output is: ' + result);
}

function createBackend(args: any, parserCtx: ParserContext): Ts2wasmBackend {
    return new WASMGen(parserCtx);
}

/** read configs from cli */
function readCfgFromCli(args: minimist.ParsedArgs) {
    const cfgs: Partial<ConfigMgr> = {};
    for (const key in args) {
        // eslint-disable-next-line no-prototype-builtins
        if (args.hasOwnProperty(key)) {
            cfgs[key as keyof ConfigMgr] = args[key];
        }
    }
    setConfig(cfgs);
}

function main() {
    try {
        const args = minimist(process.argv.slice(2));
        const optionConfig = parseOptions();
        const optionKey: string[] = [];

        Object.keys(optionConfig).forEach((commandKey) => {
            optionKey.push(commandKey);
            if (optionConfig[commandKey].alias) {
                optionKey.push(optionConfig[commandKey].alias);
            }
        });
        Object.keys(args).forEach((arg) => {
            if (arg !== '_' && optionKey.indexOf(arg) === -1) {
                console.warn("WARNING: Unknown option '" + arg + "'");
            }
        });

        readCfgFromCli(args);

        if (args.help || args.h) {
            showHelp(optionConfig);
        }
        if (args.version || args.v) {
            showVersion();
        }
        const sourceFileList: string[] = [];
        const params: string[] = [];
        for (let i = 0; i < args._.length; i++) {
            const arg = args._[i];
            if (typeof arg === 'string' && fs.statSync(arg).isFile()) {
                fs.accessSync(arg, fs.constants.R_OK);
                sourceFileList.push(arg);
            } else {
                params.push(arg);
            }
        }

        if (!sourceFileList.length) {
            showHelp(optionConfig);
        }

        if (!sourceFileList.length) {
            throw new Error('No ts file to be handled.');
        }

        if (args.dumpast) {
            DumpAST(sourceFileList);
            return;
        }

        /* Step1: Semantic checking, construct scope tree */
        const parserCtx = new ParserContext();
        parserCtx.parse(sourceFileList);
        /* Step2: Backend codegen */
        const backend = createBackend(args, parserCtx);
        backend.codegen();

        /* Step3: output */
        /* Set up specified base directory */
        const baseDir = path.normalize(args.baseDir || '.');
        let generatedWasmFile = '';
        if (args.output || args.o) {
            if (args.output) {
                generatedWasmFile = args.output;
            }
            if (args.o) {
                generatedWasmFile = args.o;
            }
            if (!generatedWasmFile.endsWith('.wasm')) {
                throw new Error('output must be a wasm file');
            }
            const options = {
                name_prefix: generatedWasmFile.split('.')[0],
            };
            const output = backend.emitBinary(options);
            writeFile(generatedWasmFile, output, baseDir);
            console.log(
                "The wasm file '" + generatedWasmFile + "' has been generated.",
            );
            if (args.sourceMap) {
                const sourceMap = backend.emitSourceMap(options.name_prefix);
                writeFile(
                    `${options.name_prefix}.wasm.map`,
                    sourceMap,
                    baseDir,
                );
                console.log(
                    `The source map file ${options.name_prefix}.wasm.map has been generated.`,
                );
            }
            if (args.validate) {
                const validateArgs: string[] = [
                    '-f',
                    args.validate,
                    getAbsolutePath(generatedWasmFile),
                ];
                validateByWAMR(validateArgs.concat(params));
            }
            if (args.wat) {
                let generatedWatFile = '';
                if (generatedWasmFile.endsWith('.wasm')) {
                    generatedWatFile = generatedWasmFile.replace(
                        '.wasm',
                        '.wat',
                    );
                } else {
                    generatedWatFile = generatedWasmFile.concat('.wat');
                }

                const output = backend.emitText();
                writeFile(generatedWatFile, output, baseDir);
                console.log(
                    "The wat file '" +
                        generatedWatFile +
                        "' has been generated.",
                );
            }
        } else if (args.wat || args.validate) {
            console.warn('WARNING: No wasm file specified.');
        } else {
            console.log(backend.emitText());
        }

        backend.dispose();
    } catch (e) {
        if (e instanceof SyntaxError) {
            /* Syntax error are reported by frontend.ts */
            console.log(e.message);
            process.exit(1);
        } else {
            /* TODO: print line number in error message */
            let errorMessage = (<Error>e).message.concat(
                `\nError details is in '${logConfig.appenders.errorFile.filename}'`,
            );
            if (process.env.NODE_ENV !== 'production') {
                errorMessage = errorMessage.concat(
                    `\nLog details is in '${logConfig.appenders.traceFile.filename}'`,
                );
            }
            consoleLogger.error(errorMessage);
            Logger.error(e);
            log4js.shutdown(() => process.exit(1));
        }
    }
}

main();
