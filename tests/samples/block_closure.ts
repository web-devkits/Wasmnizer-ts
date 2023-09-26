/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function reBindingBlockClosure() {
    let arr: Array<() => number> = [];
    for (let i = 0; i < 10; i++) {
        arr.push(() => i);
    }

    return arr;
}

function reBindingBlockClosures() {
    let arr: Array<() => number> = [];
    for (let i = 0, j = 0; i < 10 && j < 10; i++, j++) {
        arr.push(() => i + j);
    }

    return arr;
}

function notReBindingBlockClosure() {
    let arr: Array<() => number> = [];
    for (var i = 0; i < 10; i++) {
        arr.push(() => i);
    }

    return arr;
}

function partBindingBlockClosures() {
    let arr: Array<() => number> = [];
    let j = 0;
    for (let i = 0; i < 10; i++) {
        arr.push(() => i + j);
    }
    return arr;
}


function partBindingBlockClosuresWithChangeJ() {
    let arr: Array<() => number> = [];
    let j = 0;
    for (let i = 0; i < 10 && j < 10; i++, j++) {
        arr.push(() => i + j);
    }
    return arr;
}

function reBindingBlockClosureWithVarDefined() {
    let arr: Array<() => number> = [];
    let j = 0;
    for (let i = 0; i < 10 && j < 10; i++, j++) {
        let a = i;
        let b = j;
        arr.push(() => a + b);
    }

    return arr;
}

function blockClosureWithWhile() {
    let arr: Array<() => number> = [];
    let i = 0;
    while(i < 10) {
        arr.push(() => i);
        i++;
    }
    return arr;
}

function blockClosureWithWhileWithVarDefined() {
    let arr: Array<() => number> = [];
    let i = 0;
    while(i < 10) {
        let a = i;
        arr.push(() => a);
        i++;
    }
    return arr;
}

export function getRes() {
    let arr = reBindingBlockClosure();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = reBindingBlockClosures();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = notReBindingBlockClosure();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = partBindingBlockClosures();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = partBindingBlockClosuresWithChangeJ();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = reBindingBlockClosureWithVarDefined();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = blockClosureWithWhile();
    console.log(arr[1]());
    console.log(arr[5]());
    arr = blockClosureWithWhileWithVarDefined();
    console.log(arr[1]());
    console.log(arr[5]());
}
