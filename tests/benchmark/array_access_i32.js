"use strict";
/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function main() {
    var size = 1e4;
    var arr = new Array(1e4);
    var expect = 49999995000000;
    var res = 0;
    for (var i = 0, j = 0; i < 1e7; i++, j++) {
        arr[j] = i;
        res += arr[j];
        if (j >= size - 1)
            j = 0;
    }
    if (res !== expect) {
        console.log('Validate result error in array access (i32 index)');
    }
    return res;
}

main()
