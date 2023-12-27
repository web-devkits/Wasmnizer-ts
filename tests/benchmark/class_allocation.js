/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

"use strict";

var Foo = /** @class */ (function () {
    function Foo(x) {
        this.x = x;
    }
    Foo.prototype.bar = function () {
        return this.x;
    };
    return Foo;
}());
var size = 1e7;
var len = 10;
var arr = new Array(len);
function main() {
    for (var i = 0, j = 0; i < size; i++, j++) {
        if (j >= len) j = 0;
        arr[j] = new Foo(i);
    }
    return arr;
}

console.log(main());
