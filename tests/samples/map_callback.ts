/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function logMapElements(value: any, key: any, map: any) {
    console.log(key, value, map);
}

export function map_forEach() {
    const mmap: any = new Map();
    mmap.set('0', 3);
    mmap.set('1', 4);
    mmap.set('2', 5);
    mmap.forEach(logMapElements); 
    /* 
    0 3 [object Map] 
    1 4 [object Map] 
    2 5 [object Map]
    */
}

export function map_get() {
    const mmap: any = new Map();
    mmap.set('0', 'Tom');
    mmap.set('1', 'Jack');
    mmap.set('2', 'Bob');
    console.log(mmap.get('2')); // Bob
}