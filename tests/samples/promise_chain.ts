/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function promiseChain() {
    Promise.resolve<number>(123)
        .then(
            (res: number) => {
                console.log(res);
                return 456;
            },
            (res: number) => {
                console.log(res);
                return 789;
            },
        )
        .then((res: number) => {
            console.log(res);
            return Promise.resolve('hello');
        })
        .then((res: string) => {
            console.log(res);
            return Promise.reject(false);
        })
        .then((res: boolean) => {
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
    hello
    false
    finally
    */
}

export function promiseMultiThen() {
    Promise.resolve(123)
        .then(
            (res: number) => {
                console.log(res);
                return res + 10;
            },
            (res: number) => {
                console.log(res);
                return res + 100;
            },
        )
        .then(
            (res: any) => {
                console.log(res);
                return res + 10;
            },
            (res: any) => {
                console.log(res);
                return res + 100;
            },
        )
        .then(
            (res: any) => {
                console.log(res);
                return res + 10;
            },
            (res: any) => {
                console.log(res);
                return res + 100;
            },
        )
        .then(
            (res: any) => {
                console.log(res);
                return res + 10;
            },
            (res: any) => {
                console.log(res);
                return res + 100;
            },
        );

    /* Output:
123
133
143
153
*/
}
