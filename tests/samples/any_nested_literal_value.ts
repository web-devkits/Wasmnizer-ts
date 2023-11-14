/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function arrayLiteralInObjLiteral() {
    const obj: any = {
        a: 'hi',
        b: [
            {
                a: 'world',
                b: [100],
            }
        ]
    }
    console.log(obj.b[0].b[0]);
}

export function objLiteralInArrayLiteral() {
    const arr: any = [
        {
            a: 'hi',
            b: [
                {
                    a: 'world',
                    b: [100],
                },
            ],
        },
    ];
    
    console.log(arr[0].b[0].a);
}