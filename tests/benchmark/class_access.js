"use strict";
/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

var Foo = /** @class */ (function () {
    function Foo(x) {
        this.x = x;
    }
    Foo.prototype.bar = function () {
        return this.x;
    };
    return Foo;
}());
function main() {
    var size = 1e7;
    var expect = 99999970000002;
    var res = 0;
    var f = new Foo(0);
    for (var i = 0; i < size; i++) {
        res += f.x;
        res += f.bar();
        f.x = i;
    }
    if (res !== expect) {
        console.log('Validate result error in class access');
    }
    return res;
}

main()
