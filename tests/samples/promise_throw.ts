/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function promiseThrowError() {
    Promise.resolve(123)
        .then(
            (res: any) => {
                console.log(res);
                throw 456;
            },
            (res: any) => {
                console.log(res);
                return 789;
            },
        )
        .then((res: any) => {
            console.log(res);
            return Promise.resolve('hello');
        })
        .then((res: any) => {
            console.log(res);
            throw false;
        })
        .then((res: any) => {
            console.log(res);
            return Promise.resolve('hello');
        })
        .catch((error: any) => {
            console.log(error);
        })
        .finally(() => {
            console.log('finally');
        });

    /* Output:
123
456
finally
*/
}

function exception_catch_in_cb(res: any) {
    try {
        throw 'exception_catch_in_cb';
    } catch (e) {
        console.log(res);
    }
    return 456;
}

export function promiseCatchInCB() {
    Promise.resolve(123)
        .then(
            exception_catch_in_cb,
            (res: any) => {
                console.log(res);
                return 789;
            },
        )
        .then((res: any) => {
            console.log(res);
            return Promise.resolve('hello');
        })
        .catch((error: any) => {
            console.log(error);
        })
        .finally(() => {
            console.log('finally');
        });

/*
123
456
finally
 */
}

function exception_not_catch_in_cb(res: any) {
    try {
        throw 'exception_not_catch_in_cb';
    } finally {
        console.log(res);
    }
}

export function promiseNotCatchInCB() {
    Promise.resolve(123)
        .then(
            exception_not_catch_in_cb,
            (res: any) => {
                console.log(res);
                return 789;
            },
        )
        .then((res: any) => {
            console.log(res);
            return Promise.resolve('hello');
        })
        .catch((error: any) => {
            console.log(error);
        })
        .finally(() => {
            console.log('finally');
        });
/*
123
exception_not_catch_in_cb
finally
 */
}
