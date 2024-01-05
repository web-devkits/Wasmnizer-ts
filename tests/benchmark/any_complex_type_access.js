/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

"use strict";

var Foo = /** @class */ (function () {
    function Foo() {
        this.x = 0;
        this.y = false;
    }
    return Foo;
}());
var val = new Foo();
val.z = 0;
var size = 4e5;
var res = 0;
var expect = 159998800002;
function main() {
    for (var i = 0; i < size; i++) {
        res += val.x;
        val.x = i;
        res += val.z;
        val.z = i;
    }
    if (res !== expect) {
        console.log('Validate result error in any type access (complex type)');
    }
    return res;
}
console.log(main());
