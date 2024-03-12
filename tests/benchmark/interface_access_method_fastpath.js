"use strict";
/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

var Bar = /** @class */ (function () {
    function Bar(x) {
        this.x = x;
    }
    Bar.prototype.bar = function (val) {
        this.x = val;
        return this.x;
    };
    return Bar;
}());
function main() {
    var size = 1e6;
    var expect = 499999500000;
    var f = new Bar(0);
    var res = 0;
    for (var i = 0; i < size; i++) {
        res += f.bar(i);
    }
    if (res !== expect) {
        console.log('Validate result error in interface access method (fast path)');
    }
    return res;
}

main()
