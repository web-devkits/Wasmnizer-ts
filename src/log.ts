/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import path from 'path';
import log4js from 'log4js';
import stackTrace from 'stacktrace-js';
import config from '../config/log4js.js';

export enum LoggerLevel {
    TRACE = 'TRACE',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

log4js.configure(config);

const traceLogger = log4js.getLogger();
traceLogger.level = LoggerLevel.TRACE;

const productionLogger = log4js.getLogger('production');
productionLogger.level = LoggerLevel.ERROR;

export const consoleLogger = log4js.getLogger('console');
consoleLogger.level = LoggerLevel.ERROR;

export class Logger {
    static trace(...args: any[]) {
        Logger.collectLogs(args, LoggerLevel.TRACE);
    }

    static debug(...args: any[]) {
        Logger.collectLogs(args, LoggerLevel.DEBUG);
    }

    static info(...args: any[]) {
        Logger.collectLogs(args, LoggerLevel.INFO);
    }

    static warn(...args: any[]) {
        Logger.collectLogs(args, LoggerLevel.WARN);
    }

    static error(...args: any[]) {
        Logger.collectLogs(args, LoggerLevel.ERROR);
    }

    static getLocation(depth = 3): string {
        const stackFrames = stackTrace.getSync();
        const stackFrame = stackFrames[depth];
        const lineNumber = stackFrame.lineNumber!;
        const columnNumber = stackFrame.columnNumber!;
        const fileName = stackFrame.fileName!;
        const pathBaseName = path.basename(fileName);
        return `${pathBaseName} (line: ${lineNumber}, column: ${columnNumber}): \n`;
    }

    static collectLogs(args: any[], logLevel: LoggerLevel) {
        if (process.env.NODE_ENV === 'production') {
            if (logLevel === LoggerLevel.ERROR) {
                productionLogger.error((Logger.getLocation(), args));
            }
        } else {
            if (logLevel === LoggerLevel.TRACE) {
                traceLogger.trace(Logger.getLocation(), args);
            } else if (logLevel === LoggerLevel.DEBUG) {
                traceLogger.debug(Logger.getLocation(), args);
            } else if (logLevel === LoggerLevel.INFO) {
                traceLogger.info(Logger.getLocation(), args);
            } else if (logLevel === LoggerLevel.WARN) {
                traceLogger.warn(Logger.getLocation(), args);
            } else if (logLevel === LoggerLevel.ERROR) {
                traceLogger.error(Logger.getLocation(), args);
            }
        }
    }
}
