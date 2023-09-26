/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class D {
    //
}

interface G {
    //
}

export function typeofTest() {
    const a = 10;
    const b = '123';
    const c = false;

    const d = new D();
    const e = new Array<D>();
    const f = { a: 1 };

    const g: G = new D();
    const h = null;
    const i = undefined;

    const j: 1 | 2 = 1;
    let k: string | D = '123';
    const l: any = new Array<D>();
    const m: any = { aa: 1 };
    const n: any = 1;
    const o: any = '123';
    const p: any = () => {
        //
    };
    console.log(typeof a);
    console.log(typeof b);
    console.log(typeof c);
    console.log(typeof d);
    console.log(typeof e);
    console.log(typeof f);
    console.log(typeof g);
    console.log(typeof h);
    console.log(typeof i);
    console.log(typeof j);
    console.log(typeof l);
    console.log(typeof m);
    console.log(typeof n);
    console.log(typeof o);
    console.log(typeof p);

    if (typeof k === 'string') {
        k = new D();
        console.log(typeof k);
    }
}
