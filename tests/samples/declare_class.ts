/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

declare class DeclaredClass {
    grade: number;
    constructor(grade: number);
    sayHello(): void;
    static whoSayHi(name: string): number;
    get value(): any;
    set value(v: number);
}

export function classDecl() {
    const sayHiFunc = DeclaredClass.whoSayHi('i');
    console.log(sayHiFunc);
    const dc = new DeclaredClass(99);
    console.log(dc.grade);
    dc.value = 100;
    console.log(dc.value);
    dc.sayHello();
}
