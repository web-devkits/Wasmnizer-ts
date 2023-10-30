/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function anyFuncCallWithNumber() {
    const fn1: any = (a: number): number => {
        return a;
    };
    const fn2: any = (a: number): number => {
        return a + 100;
    };
    const a1 = fn1(20);
    console.log(a1);
    const a2 = fn2(10)
    console.log(a2);
}

function funcWithBoolean(a: boolean) {
    if (a) {
        return 10;
    }
    return 11;
}

export function anyFuncCallWithBoolean() {
    const fn1: any = (a: boolean): boolean => {
        return a;
    };
    const fn2: any = funcWithBoolean;
    const a1 = fn1(true);
    console.log(a1);
    const a2 = fn2(false);
    console.log(a2);
}

export function anyFuncCallWithString() {
    const fn1: any = (): string => {
        return 'hi';
    };
    const fn2: any = (a: string): string => {
        return a.concat(', world');
    };
    const a1 = fn1();
    console.log(a1);
    const a2 = fn2('hello');
    console.log(a2);
}

export function anyFuncCallWithAny() {
    const fn1: any = (a: any): number => {
        return 100;
    };
    const fn2: any = (a: any): any => {
        return a;
    };
    const a = fn1(8);
    console.log(a);
    const b = fn2('world');
    console.log(b);
}

export function anyFuncCallWithFunc() {
    const fn: any = (a: ()=>number): ()=>number => {
        return a;
    };
    const a = fn(()=> {return 8});
    const b = a();
    console.log(b);
}

class A {
    x = 3;
    y = true;
}

export function anyFuncCallWithClass() {
    const fn: any = (a: A): A => {
        return a;
    };
    const obj: A = new A();
    const a = fn(obj);
    console.log(a.x);
    console.log(a.y);
    a.x = 1;
    console.log(a.x);
}

export function anyFuncCallWithObj_static() {
    const fn: any = (a: {x: number, y:boolean}):{x: number, y:boolean}  => {
        return a;
    };
    const obj = {x:3, y:true};
    const a = fn(obj);
    console.log(a.x);
    console.log(a.y);
    a.x = 1;
    console.log(a.x);
}

interface I {
    x: number;
    y: boolean;
}

export function anyFuncCallWithInfc_class() {
    const fn: any = (a: I): I => {
        return a;
    };
    const obj:I = new A();
    const a = fn(obj);
    console.log(a.x);
    console.log(a.y);
    a.x = 1;
    console.log(a.x);
}

export function anyFuncCallWithInfc_obj() {
    const fn: any = (a: I): I => {
        return a;
    };
    const obj:I = {x:3, y:true};
    const a = fn(obj);
    console.log(a.x);
    console.log(a.y);
    a.x = 1;
    console.log(a.x);
}

export function anyFuncCallWithArray_static() {
    const fn: any = (a: number[]): number[] => {
        return a;
    };
    const arr = [9, 6];
    const a = fn(arr);
    const b = a[0];
    console.log(b);
    a[1] = 10;
    console.log(a[1]);
    const len = a.length;
    console.log(len);
}

export function anyFuncCallWithArray_extref() {
    const fn: any = (a: number[]): number[] => {
        return a;
    };
    const arr = [9, 6];
    const arr_any: any = arr;
    const a = fn(arr_any);
    const b = a[0];
    console.log(b);
    a[1] = 10;
    console.log(a[1]);
    const len = a.length;
    console.log(len);
}

export function anyFuncCallInMap() {
    const m:any = new Map();
    m.set(1, funcWithBoolean);
    const fn = m.get(1);
    const res = fn(true);
    console.log(res);
}

class Page {
    index = 0;
    log(): void {
        console.log('Page class');
    }
    increase() {
        this.index++;
        console.log(this.index);
    }
}

export function anyFuncCallWithCast() {
    const map: any = new Map();
    const fn = () => {
        return new Page();
    };
    map.set('Page', fn);
    const a = map.get('Page');
    const b = a() as Page;
    b.log();
    b.increase();
}

export function anyFuncCallWithNoCast() {
    const map: any = new Map();
    const fn = () => {
        return new Page();
    };
    map.set('Page', fn);
    const a = map.get('Page');
    const b = a();
    b.log();
    b.increase();
}

class A1 {
    test() {
        console.log(1);
    }
}
class B1 {
    a?: A1 = new A1();
    fun() {
        if (this.a) {
            this.a.test();
        }
    }
}

export function unionFuncCall() {
    const b = new B1();
    b.fun();
}
