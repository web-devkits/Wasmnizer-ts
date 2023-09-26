/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function throwNewError() {
    throw new Error('A new error');
}

export function noThrow() {
    let a = 1;
    try {
        throw 'hh';
        a += 10;
    } finally {
        a += 100;
        console.log('execute in finally');
        throw 'iii'
        return a;
    }
    return a;
}

export function throwErrorInTry() {
    let a = 1;
    try {
        a += 1;
        throw new Error('throw error in try');
    } catch (e) {
        a += 2;
    } finally {
        a += 3;
    }
    return a;
}

export function throwErrorInFunc() {
    let a = 1;
    try {
        a += 1;
        throwNewError();
    } catch (e) {
        a += 2;
    } finally {
        a += 3;
    }
    return a;
}

export function throwErrorInCatch() {
    let a = 1;
    try {
        a += 1;
    } catch (e) {
        a += 2;
        throw new Error('throw error in catch');
    } finally {
        a += 3;
    }
    return a;
}

export function throwErrorInFinally() {
    let a = 1;
    try {
        a += 1;
    } catch (e) {
        a += 2;
    } finally {
        a += 3;
        throw new Error('throw error in finally');
    }
    return a;
}

export function throwErrorInTryAndCatch() {
    let a = 1;
    try {
        a += 1;
        throw new Error('throw error in try');
    } catch (e) {
        a += 2;
        throw new Error('throw error in catch');
    } finally {
        a += 3;
    }
    return a;
}

export function throwErrorInTryAndFinally() {
    let a = 1;
    try {
        a += 1;
        throw new Error('throw error in try');
    } catch (e) {
        a += 2;
    } finally {
        a += 3;
        throw new Error('throw error in finally');
    }
    return a;
}

export function throwErrorInTryAndCatchAndFinally() {
    let a = 1;
    try {
        a += 1;
        throw new Error('throw error in try');
    } catch (e) {
        a += 2;
        throw new Error('throw error in catch');
    } finally {
        a += 3;
        throw new Error('throw error in finally');
    }
    return a;
}

export function nestedThrowError() {
    let a = 1;
    try {
        a += 1;
        try {
            a += 1;
            throw new Error('throw error in try');
        } catch (e) {
            a += 2;
            throw new Error('throw error in catch');
        } finally {
            a += 3;
            throw new Error('throw error in finally');
        }
    } catch (e) {
        a += 2;
    } finally {
        a += 3;
    }
    return a;
}
