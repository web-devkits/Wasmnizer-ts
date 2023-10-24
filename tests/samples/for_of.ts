/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

const arr = [1, 4, 6];
const str = 'abc';
const dynArr: any = [2, 3, 5];

export function forOfForArray(): void {
    for (const element of arr) {
        console.log(element);
    }

    for (const element of arr) console.log(element);

    const localArr = arr;
    for (const element of localArr) {
        console.log(element);
    }
    for (const element of dynArr) {
        console.log(element);
    }
    for (const element of dynArr) console.log(element);
    const localDynArr = dynArr;
    for (const element of localDynArr) {
        console.log(element);
    }
}

export function forOfForString() {
    let char: string;
    for (char of str) {
        console.log(char);
    }
}

const map: any = new Map();
const set: any = new Set();
map.set('key1', 'value1');
map.set('key2', 'value2');
set.add('value1');
set.add('value2');

let mapKeys = map.keys();
const mapValue = map.values();
const mapEntries = map.entries();
const setValues = set.values();

export function forOfForMapKeys() {
    for (const element of mapKeys) {
        console.log(element);
    }
    mapKeys = map.keys();
    for (const element of mapKeys)
        console.log(element);
    const localMapKeys = map.keys();
    for (const element of localMapKeys) {
        console.log(element);
    }
}

export function forOfForMapValues() {
    for (const element of mapValue) {
        console.log(element);
    }
    const localMapValue = map.values();
    for (const element of localMapValue) {
        console.log(element);
    }
}

export function forOfForMapEntries() {
    for (const element of mapEntries) {
        console.log(element);
    }
    const localMapEntries = map.entries();
    for (const element of localMapEntries) {
        console.log(element);
    }
}

export function forOfForSetValues() {
    for (const element of setValues) {
        console.log(element);
    }
    const localSetValues = set.values();
    for (const element of localSetValues) {
        console.log(element);
    }
}
