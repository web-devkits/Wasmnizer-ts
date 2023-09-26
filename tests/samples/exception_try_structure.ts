/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function oneTryCatch() {
    let a = 1;
    try {
        a += 1;
    } catch {
        a += 2;
    }
    return a;
}

export function oneTryFinally() {
    let a = 1;
    try {
        a += 1;
    } finally {
        a += 3;
    }
    return a;
}

export function oneTryCatchFinally() {
    let a = 1;
    try {
        a += 1;
    } catch {
        a += 2;
    } finally {
        a += 3;
    }
    return a;
}

export function nestedTryCatchInTry() {
    let a = 1;
    try {
        a += 1;
        try {
            a += 1;
        } catch {
            a += 2;
        }
    } catch {
        a += 2;
    }
    return a;
}

export function nestedTryCatchInCatch() {
    let a = 1;
    try {
        a += 1;
    } catch {
        a += 2;
        try {
            a += 1;
        } catch {
            a += 2;
        }
    }
    return a;
}

export function nestedTryFinallyInTry() {
    let a = 1;
    try {
        a += 1;
        try {
            a += 1;
        } finally {
            a += 3;
        }
    } finally {
        a += 3;
    }
    return a;
}

export function nestedTryFinallyInFinally() {
    let a = 1;
    try {
        a += 1;
    } finally {
        a += 3;
        try {
            a += 1;
        } finally {
            a += 3;
        }
    }
    return a;
}

export function nestedTryCatchFinallyInTry() {
    let a = 1;
    try {
        a += 1;
        try {
            a += 1;
        } catch {
            a += 2;
        } finally {
            a += 3;
        }
    } catch {
        a += 2;
    } finally {
        a += 3;
    }
    return a;
}

export function nestedTryCatchFinallyInFinally() {
    let a = 1;
    try {
        a += 1;
    } catch {
        a += 2;
    } finally {
        a += 3;
        try {
            a += 1;
        } catch {
            a += 2;
        } finally {
            a += 3;
        }
    }
    return a;
}
