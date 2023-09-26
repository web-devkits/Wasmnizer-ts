/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class Test {
    static getNum(): number {
        return 0;
    }
    getNum1(): number {
        return 1;
    }
}

interface F {
    getNum1(): number;
}

let t: Test;
t = new Test();

if (t.getNum1()) {
    console.log(1);
}
if (Test.getNum()) {
    console.log(0);
}

const num = 10 + 10;
let num1: number;
num1 = num;

const bool_ = t.getNum1() ? true : false;
let bool_1: boolean;
bool_1 = bool_;

function helper() {
    return 'hello';
}
const str = helper();
let str1: string;
str1 = str;

function helper1() {
    return new Array<number>();
}
const arr = helper1();
let arr1: Array<number>;
arr1 = arr;

let any1: any;
any1 = 10;

const any2 = undefined;
let any3: any;
any3 = any2;

const f: F = t;
console.log(f.getNum1());

export function entry() {
    // entry
}
