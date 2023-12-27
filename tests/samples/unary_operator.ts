/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

let globalIndex: number = 3
function increasePre(): number {
    return ++globalIndex;
}
function increasePost(): number {
    return globalIndex++;
}
function decreasePre(): number {
    return --globalIndex;
}
function decreasePost(): number {
    return globalIndex--;
}

function plusplusTest() {
    let ret = increasePre();
    console.log(ret);
    console.log(globalIndex);

    ret = increasePost();
    console.log(ret);
    console.log(globalIndex);

    let localIndex = 0;
    console.log(localIndex++);
    console.log(++localIndex);
}

function minusminusTest() {
    let ret = decreasePre();
    console.log(ret);
    console.log(globalIndex);

    ret = decreasePost();
    console.log(ret);
    console.log(globalIndex);

    let localIndex = 2;
    console.log(localIndex--);
    console.log(--localIndex);
}

function exclamationTest() {
    const f = 0;
    console.log(!f);

    const t = 1;
    console.log(!t);
}

function minusTest() {
    const a = 1;
    console.log(-a);

    const b = -2;
    console.log(-b);
}

export function test() {
    plusplusTest();
    minusminusTest();
    exclamationTest();
    minusTest();
}
