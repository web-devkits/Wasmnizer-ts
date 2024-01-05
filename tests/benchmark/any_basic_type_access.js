/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

"use strict";

var size = 1e6;
var val = 0;
var res = 0;
const expect = 499998500001;

function main() {
    for (var i = 0; i < size; i++) {
        res += val;
        val = i;
    }
    if (res !== expect) {
        console.log('Validate result error in any type access (basic type)');
    }
    return res;
}

console.log(main());
