/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function basicLoop(): number {
    let c = 100;
    while (c > 90) {
        c = 10;
    }
    return c;
}

export function loopBodyEmpty(): number {
    const c = 100;
    // eslint-disable-next-line no-empty
    while (c > 100) {}
    return c;
}

export function loopBodySemicolon(): number {
    const c = 100;
    // eslint-disable-next-line no-empty
    while (c > 100);
    return c;
}

export function complexLoop(): number {
    let c = 100;
    while (c > 0) {
        c--;
        for (let i = 0; i < 100; i++) {
            c--;
            if (c < 50) {
                break;
            }
        }
        break;
    }
    return c;
}

export function whileWithContinue(): boolean {
    const expect = [3, 4, 5, 6, 7, 1, 3];
    const res: number[] = [];

    let i = 0;

    while (i < 10) {
        i++;
        if (i < 3) continue;
        if (i > 7) continue;
        res.push(i);
    }

    i = 0;

    while (i < 10) {
        i++;
        if (i % 2 === 0) continue;
        if (i === 5) break;
        res.push(i);
    }

    if (res.length !== expect.length) return false;
    for (let i = 0; i < expect.length; i++) {
        if (res[i] !== expect[i]) return false;
    }

    return true;
}
