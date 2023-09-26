/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_findIndex_number() {
    const arr = [1, 2, 3, 4, 5];
    const foundIndex = arr.findIndex((element, idx, arr) => {
        return element > 2;
    });
    const notfoundIndex = arr.findIndex((element, idx, arr) => {
        return element > 6;
    });

    console.log('foundIndex:', foundIndex);
    console.log('notfoundIndex:', notfoundIndex);
}

export function array_findIndex_string() {
    const words = ['spray', 'limit', 'elite', 'exuberant', 'destruction', 'present'];
    const result = words.findIndex((word, idx, arr) => word.length > 6);
    const noresult = words.findIndex((word, idx, arr) => word.length > 20);

    console.log('result:', result);
    console.log('noresult:', noresult);
}

export function array_findIndex_boolean() {
    const boolArr = [false, true, false, true];
    const index = boolArr.findIndex((element, idx, arr) => !!element);

    console.log(index);
}

export function array_findIndex_class() {
    const array = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 35 },
        { name: "David", age: 40 }
    ];

    const index1 = array.findIndex((person, idx, arr) => person.age === 30);
    console.log(index1);

    const index2 = array.findIndex((person, idx, arr) => person.age === 50);
    console.log(index2);
}

export function array_findIndex_interface() {
    interface SomeInterface {
        id: number;
        name: string;
    }

    let someArray: SomeInterface[] = [
        { id: 1, name: "John" },
        { id: 2, name: "Mary" }
    ];

    let index = someArray.findIndex((item, idx, arr) => item.id === 2);
    console.log(index);
}