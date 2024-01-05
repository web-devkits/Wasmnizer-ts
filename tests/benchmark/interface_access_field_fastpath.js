/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

"use strict";

var Bar = /** @class */ (function () {
    function Bar() {
        this.x = 0;
        this.y = false;
    }
    return Bar;
}());
var size = 1e6;
var expect = 499998500001;
var f = new Bar();
var res = 0;
function main() {
    for (var i = 0; i < size; i++) {
        res += f.x;
        f.x = i;
    }
    if (res !== expect) {
        console.log(
            'Validate result error in interface access field (fast path)',
        );
    }
    return res;
}
console.log(main());
