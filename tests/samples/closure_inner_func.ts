/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function outerFunc() {
    let a = 1;

    function inner() {
        console.log(a);
        a--;
    }

    function inner2() {
        a++;
        inner();
        console.log(a);
    }

    inner2();
}

function outerWithBlock(a:number) {
    if (a > 1) {
        function inner() {
            console.log(a + 50);
        }

        function inner2() {
            return inner;
        }

        return inner2();

    } else {
        function inner() {
            console.log(a + 100);
        }

        function inner2() {
            return inner;
        }

        return inner2();

    }
}

export function outerFuncWithBlock() {
    outerWithBlock(2)();
    outerWithBlock(0)();
}
