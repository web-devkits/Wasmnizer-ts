/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A1 {
    func_a() {
        console.log('Class method');
    }

    test() {
        return {
            func_a() {
                console.log('ObjLiteral method');
            },
            event: () => {
                this.func_a();
            },
        };
    }
}

export function thisInObjLiteralArrowFunc() {
    const a = new A1();
    a.test().event();
}

class A2 {
    func_a() {
        console.log('Class method');
    }

    test() {
        return {
            func_a() {
                console.log('ObjLiteral method');
            },
            event: function(){
                this.func_a();
            },
        };
    }
}

export function thisInObjLiteralFuncExpr() {
    const a = new A2();
    a.test().event();
}
