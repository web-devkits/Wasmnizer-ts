/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export class SyntaxError extends Error {
    constructor(message: string) {
        super('[SyntaxError]\n' + message);
    }
}

export class UnimplementError extends Error {
    constructor(message: string) {
        super('[UnimplementError]\n' + message);
    }
}

export class ValidateError extends Error {
    constructor(message: string) {
        super('[ValidateError]\n' + message);
    }
}

export class TypeError extends Error {
    constructor(message: string) {
        super('[TypeError]\n' + message);
    }
}

export class ExpressionError extends Error {
    constructor(message: string) {
        super('[ExpressionError]\n' + message);
    }
}

export class ScopeError extends Error {
    constructor(message: string) {
        super('[ScopeError]\n' + message);
    }
}

export class SemanticCheckError extends Error {
    constructor(message: string) {
        super('[SemanticCheckError]\n' + message);
    }
}

export class StatementError extends Error {
    constructor(message: string) {
        super('[StatementError]\n' + message);
    }
}
