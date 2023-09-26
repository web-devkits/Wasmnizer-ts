/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    // tslint:disable-next-line: no-empty
}

interface I {
    // tslint:disable-next-line: no-empty
}

export function toStringTest() {
    const a = '1';

    const b = 1;
    console.log(a + b.toString() === a + b);

    const c = false;
    console.log(a + c === a + c.toString());

    const d = ['1', '2d', '3'];
    console.log(a + d === a + d.toString());
    console.log(a + d.toString().length);

    const e = { a: 1, b: 2 };
    console.log(a + e == a + e.toString());

    const f = new A();
    console.log(a + f == a + f.toString());

    const g: I = f;
    console.log(a + g ==a + g.toString());

    const h = () => {
        return 10;
    }
    console.log(a + h == a + h.toString());

    let i: A | number = 10;
    console.log(a + i.toString());
    i = new A();
    console.log(a + i.toString());

    let j: any = undefined;
    console.log(a + j.toString());

    j = null;
    console.log(a + j.toString());

    j = ['1', '2'];
    console.log(a + j.toString());

    j = () => {
        //
    }
    console.log(a + j.toString());

    j = 10;
    console.log(a + j.toString());

    j = new A();
    console.log(a + j.toString());

    const str1 = 'start';
    const str2 = 'middle';
    console.log(str1 + str2);
    console.log(2001 + ': A Space Odyssey');
}
