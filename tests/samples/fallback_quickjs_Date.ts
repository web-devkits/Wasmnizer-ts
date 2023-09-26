/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

let date = new Date();
//console.log(date.getTime());

//console.log(Date.now());
console.log(Date.parse('2023-7-27'));

export function DateTest1() {
    let date = new Date(2023, 7);
    console.log(date.getFullYear());

    let date1 = new Date('December 17, 1995 03:24:00');
    console.log(date1);

    let date2 = new Date('1995-12-17T03:24:00');
    console.log(date2.getFullYear())

    let date3 = new Date(2023, 7, 23, 12, 1, 0, 0);
    console.log(date3.getFullYear());

    console.log(Date.parse('2023-7-27'));
    console.log(Date.UTC(2023, 7, 23));
}

export function DateTest2() {
    let date = new Date(2023, 7);
    console.log(date.getFullYear());

    console.log(Date.parse('2023-7-27'));
}