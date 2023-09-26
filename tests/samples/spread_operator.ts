/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
}

interface IA {
    name: string;
}

export function spread_number_array() {
    let a = [1, 2, 3];
    let b = [10, ...a, 20, ...a];
    console.log(b.length);          // 8
    console.log(b[2]);              // 2
    let c = [...a, 10];
    console.log(c.length);          // 4
    console.log(c[0]);              // 1

    let d: number[] = [];
    let e = [...d];
    console.log(e.length);          // 0

    let f: any = [];
    let g = [...f];
    let h: any = [...f];
    console.log(g.length);          // 0
    console.log(h.length);          // 0
}

export function spread_boolean_array() {
    let a = [true, false];
    let b = [false, ...a, ...a];
    console.log(b.length);          // 5
    console.log(b[1]);              // true
    console.log(b[2]);              // false
}

export function spread_string_array() {
    let a = ["1", "2"];
    let b = ["3", ...a];
    console.log(b.length);          // 3
    console.log(b[1]);              // 1
}

export function spread_object_array() {
    let a = [new A("A1"), new A("A2")];
    let b = [new A("A3"), ...a];
    console.log(b.length);          // 3
    console.log(b[1].name);         // A1
    b[1].name = "A4";
    console.log(b[1].name);         // A4
    console.log(a[0].name);         // A4
}

export function spread_interface_array() {
    let a: IA[] = [new A("A1"), new A("A2")];
    let b: IA[] = [new A("A3"), ...a];
    console.log(b.length);          // 3
    console.log(b[1].name);         // A1
}

export function spread_literal_array() {
    let a = [1, ...[1, 2, 3], 4];
    console.log(a.length);
    console.log(a[1])
    console.log(a[2]);
    console.log(a[4]);

    let b = ["1", ...["1", "2"]];
    console.log(b.length);
    console.log(b[1]);
    console.log(b[2]);

    let c = [true, ...[false, true]];
    console.log(c.length);
    console.log(c[1]);
    console.log(c[2]);

    let d = [new A("A1"), ...[new A("A2"), new A("A3")]];
    console.log(d.length);
    console.log(d[1].name);
    console.log(d[2].name);

    let e = [1, ...[...[1, 2]]];
    console.log(e.length);
    console.log(e[1]);
    console.log(e[2]);

    let f = [1, 2, 3];
    let g = [1, ...[f.pop()]];
    console.log(f.length);
    console.log(f[1]);
    console.log(g[1]);
}

export function spread_any_array() {
    let a: any = [1, 2, 3];
    let b = [10, ...a];
    console.log(b.length);          // 4
    console.log(b[1]);              // 1

    a = [1, "2", new A("A1")];
    b = [1, ...a];
    console.log(b.length);          // 4
    console.log(b[3].name);         // A1

    let c: any = [...a, 10, ...a];
    console.log(c.length);          // 7
    console.log(c[2].name);         // A1
    console.log(c[3]);              // 10
}

export function spread_nested_array() {
    let a: any = [1, 2];
    let b = [a, 3];
    let c = [...b, 4];
    console.log(c.length);
    console.log(c[0][1]);
    console.log(c[2]);
    c[0][0] = 5;
    console.log(a[0])
}

function test1(arg: number, ...args: number[]) {
    console.log(args.length);
    console.log(args[0]);
    console.log(args[args.length - 1]);
}

function test2(arg: string, ...args: string[]) {
    console.log(args.length);
    console.log(args[0]);
    console.log(args[args.length - 1]);
}

function test3(arg: A, ...args: A[]) {
    console.log(args.length);
    console.log(args[0].name);
    console.log(args[args.length - 1].name);
}

function test4(arg: IA, ...args: IA[]) {
    console.log(args.length);
    console.log(args[0].name);
    console.log(args[args.length - 1].name);
}

function test5(arg: any, ...args: any[]) {
    console.log(args.length);
    console.log(args[0]);
    console.log(args[1].name);
    console.log(args[args.length - 1].name);
}

export function pass_spread_to_rest_param() {
    let a = [1, 2, 3];
    test1(10, 20, ...a, 30);

    let b = ["1", "2", "3"];
    test2("10", "20", ...b);

    let c = [new A("A1"), new A("A2")];
    test3(new A("A10"), new A("A20"), ...c, new A("A30"));

    test4(new A("A10"), new A("A20"), ...c);

    let d: any[] = [1, 2, 3, "3", true, new A("A1")];
    test5(1, 2, new A("A3"), ...d);
}