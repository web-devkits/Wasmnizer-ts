/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

/* Workaround: since console is not used as `declare var console: Console;` in type.d.ts
 * so we should keep this definition here.
 */
export declare class Console {
    log(...values: any[]): void;
}

export class Math {
    pow(x: number, y: number): number {
        let res = 1;
        let power = y < 0 ? -y : y;
        while (power > 0) {
            res = res * x;
            power--;
        }
        res = y < 0 ? 1 / res : res;
        return res;
    }

    max(...x: number[]): number {
        const arrLen = x.length;
        let res = x[0];
        for (let i = 1; i < arrLen; i++) {
            if (res < x[i]) {
                res = x[i];
            }
        }
        return res;
    }

    min(...x: number[]): number {
        const arrLen = x.length;
        let res = x[0];
        for (let i = 1; i < arrLen; i++) {
            if (res > x[i]) {
                res = x[i];
            }
        }
        return res;
    }
}

export class ArrayBufferConstructor {
    isView(arg: any) {
        /* workaround: TypedArray is not supported */
        if (arg instanceof DataView) {
            return true;
        } else {
            return false;
        }
    }
}
