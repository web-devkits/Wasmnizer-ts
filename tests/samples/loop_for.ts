/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function basicCase(): number {
    let c = 100;
    for (let q = 10; q > 4; --q) {
        c = c + 2;
        c--;
    }
    return c;
}

export function loopBodySemicolon(): number {
    const c = 100;
    for (let i = 2; i < 5; i++);
    return c;
}

export function loopBodyEmpty(): number {
    const c = 100;
    // eslint-disable-next-line no-empty
    for (let k = 10; k > 4; --k) {}
    return c;
}

export function noInitializer(): number {
    let c = 100;
    let j = 0;
    for (; j < 10; ++j) {
        c--;
    }
    return c;
}

export function noCondition(): number {
    let c = 100;
    let j = 0;
    for (j = 0; ; ++j) {
        c--;
        if (j > 10) {
            break;
        }
    }
    return c;
}

export function noIncrement(): number {
    let c = 100;
    let j = 0;
    for (j = 0; j < 10;) {
        c--;
        j++;
    }
    return c;
}

export function nestedForLoopWithBreak(): number {
    let c = 100;
    for (let i = 1; i < 10; i++) {
        c++;
        for (let j = 1; j < 5; j++) {
            c++;
            if (c > 108) {
                break;
            }
        }
        break;
    }
    return c;
}

export function multipleForLoop(): number {
    let c = 100;
    for (let q = 10; q > 4; --q) {
        c = c + 2;
    }
    for (let i = 0; i < 3; i++) {
        c = c + 1;
    }
    return c;
}

export function loopWithCommaToken() {
    let sum = 0;
    let str = '';
    for (let i = 0, j = 4; i < 10; i++, j += 2) {
        sum += i;
        sum += j;
    }
    sum++, str = '123', --sum;

    return sum + (str == '123' ? 1 : 2); // 176
}

export function loopWithContinue() {
    const expect = [0, 2, 0, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2, 0, 2, 2, 1, 3, 5, 1, 3];
    const res: number[] = [];
    for (let i = 0; i < 3; i++) {
        if (i === 1) {
            continue;
        }
        res.push(i);
    }

    for (let i = 0; i < 3; i++) {
        if (i === 1) {
            continue;
        }
        for (let j = 0; j < 3; j++) {
            if (j === 1) {
                continue;
            }
            res.push(j);

        }
        res.push(i);

    }

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (j === 1) {
                continue;
            }
            res.push(j);
        }
        if (i === 1) {
            continue;
        }
        res.push(i);
    }

    for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) continue;
        if (i > 5) continue;
        res.push(i);

    }

    for (let i = 0; i < 10; i++) {
        if (i === 5) break;
        if (i % 2 === 0) continue;
        res.push(i);
    }

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
