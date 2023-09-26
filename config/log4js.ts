/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import os from 'os';
import fs from 'fs';
import path from 'path';

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts2wasm-log-'));

const logConfig = {
    appenders: {
        console: {
            type: 'console',
        },
        traceFile: {
            type: 'file',
            filename: `${path.join(logDir, 'trace.log')}`,
            backups: 3,
        },
        errorFile: {
            type: 'file',
            filename: `${path.join(logDir, 'error.log')}`,
            backups: 3,
        },
        filterFile: {
            type: 'logLevelFilter',
            level: 'ERROR',
            appender: 'errorFile',
        },
    },
    categories: {
        default: {
            appenders: ['traceFile', 'filterFile'],
            level: 'trace',
        },
        production: {
            appenders: ['filterFile'],
            level: 'error',
        },
        console: {
            appenders: ['console'],
            level: 'error',
        },
    },
};

export default logConfig;
