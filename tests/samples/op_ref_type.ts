/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function judgeIsRefNull() {
    const accounts = [{a: 1}, {a: 2}];
    const account1 = accounts[0];
    const account2 = accounts[1];
    const account3 = null;

    if (account1 && account2) {
        console.log('both find')
    } else {
        console.log('at least one found');
    }

    if (account1 && account3) {
        console.log('both find')
    } else {
        console.log('at least one found');
    }

    if (account1 || account3) {
        console.log('one find')
    } else {
        console.log('no found');
    }
}
