/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

type int = number;
type pet = 'cat' | 'dog';

interface Point<T> {
   x: T;
   y: T;
}

type IntPoint = Point<int>;

type num = 1 | 2; // number
type bool = true | false; // boolean
type obj = {a: 1} | {b: 2}; // object
type func = (() => void); // function


function pet_point(p: pet, point: IntPoint) {
   console.log(p, point.x, point.y);
}

function num_add(n1: num, n2: num): number {
   return n1 + n2;
}

function bool_test(b: boolean): number {
   return b ? 1 : 0;
}

function obj_test(o: obj) {
   console.log(o);
}

function func_test(f: func) {
   f();
}

type newA = () => A;

const a: newA = () => {
    return new A();
};

function func() {
    return new A();
}

export function useTypeBeforeDefine() {
    a();
    func();
}

class A {
    constructor() {
        console.log('A');
    }
}
