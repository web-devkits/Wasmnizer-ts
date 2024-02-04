/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function loopBodyEmpty() {
    const o = 9;
    const c = 10;
    // eslint-disable-next-line no-empty
    do {} while (c > 100);
    return c;
}

export function basicDoLoop() {
    let c = 10;

    do {
        c++;
    } while (c < 100);
    return c;
}

export function prefixPlusPlus(): number {
    let o = 9;
    let c = 10;
    do {
        c++;
    } while (++o < 20);
    return c;
}

export function suffixPlusPlus(): number {
    let o = 9;
    let c = 10;
    do {
        c++;
    } while (o++ < 20);
    return c;
}

export function numberAsCondition(): number {
    let o = 9;
    let c = 10;

    do {
        c--;
    } while (c);

    return c;
}

export function doWhileWithContinue() {
    const expect = [1, 3, 5, 3, 4, 5, 6, 7, 1, 3, 1, 3, 5, 6, 7, 9];
    const res: number[] = [];

    let i = 0;
    do {
        i++;
        if (i % 2 === 0) continue;
        res.push(i);
    } while (i < 5);

    i = 0;
    do {
        i++;
        if (i < 3) continue;
        if (i > 7) continue;
        res.push(i);
    } while (i < 10);

    i = 0;
    do {
        i++;
        if (i === 5) break;
        if (i % 2 === 0) continue;
        res.push(i);
    } while (i < 10);

    i = 0;
    do {
        i++;
        if (i % 2 === 0 && i % 3 !== 0) continue;
        res.push(i);
    } while (i < 10);

    if (res.length !== expect.length) {
        return false;
    }

    for (let i = 0; i < expect.length; i++) {
        if (res[i] !== expect[i]) {
            return false;
        }
    }

    return true;
}
