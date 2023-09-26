/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function simpleObject() {
    const obj1 = {
        a: 1,
        b: true,
        c: 'hi',
    };
    return obj1.a;
}
// 1

export function nestedObject() {
    const obj1 = {
        a: 1,
        b: true,
        c: {
            d: 4,
        },
    };
    return obj1.c.d;
}
// 4

export function moreNestedObject() {
    const obj1 = {
        a: 1,
        b: true,
        c: {
            d: 4,
            e: {
                f: false,
            },
        },
    };
    return obj1.c.e.f;
}

export function assignObjectLiteralToField() {
    const obj1 = {
        a: 1,
        b: true,
        c: {
            d: 4,
        },
    };
    obj1.c = {
        d: 6,
    };
    return obj1.c.d;
}
// 6

export function withMethodField() {
    const i = (m: number) => {
        return m * m;
    };
    const obj = {
        y: 11,
        x: i,
        z: {
            k: false,
            j: (x: number, y: number) => {
                return x + y;
            },
        },
    };
    return obj.z.j(8, 9) + obj.x(10);
}
// 117

class A {
    x = 'xxx';
}

class B extends A {
    y = 1;
}

export function structWithSameLayout() {
    const val = new A();

    const res = {
        xx: val.x,
        y: 1,
    };
    return res.y;
}

interface IA {
    name: string;
    say(n: number): number;
    say2(): void;
}

export function useThisInLiteralObj() {
    const a: IA = {
        name: "A",
        say(n: number) {
            console.log(this.name);
            return n;
        },
        say2(){
            console.log(this.name);
        }

    }
    console.log(a.say(1));
    a.say2();

    const b = {
        name: "B",
        say(n: number) {
            console.log(this.name);
            return n;
        },
        say2() {
            console.log(this.name);
        }
    }
    console.log(b.say(1));
    b.say2();
}