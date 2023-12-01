/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function stringNotReturned() {
    const a: string = 'hello';
}

export function returnString(): string {
    const a: string = 'hello';
    return a;
}

export function assignStringToVariable() {
    let a: string;
    a = 'hello';
    return a;
}

export function noExplicitStringKeyword() {
    const a = '';
    return a;
}

export function unicode() {
    const a: string = '🀄';
    return a;
}

export function noSubstitutionTplLiteral() {
    const a = `hello`;
    console.log(a);
    const b = ``;
    console.log(b);
    const c = `
        This is
        a multiline
        string.`;
    console.log(c);
}

// string template
function helper(str: string, num: number) {
    return `${str} is not ${num}`;
}

class A {
    x = 'hi';
    y = `${this.x} x`;

    get xx() {
        return `${this.x} is x`;
    }

    static staticField = 10;
}

interface I {
    x: string;
    y: string;
    get xx(): string;
    set xx(value: string);
}

function foo() {
    const x = 10;
    return `${x} is 10`;
}

function outer() {
    const x = 0;
    function inner() {
        return `${x} is 0`;
    }
    return inner;
}

export function templateString() {
    const num = 1,
        str = 'Hello';
    const tplStrAsStr = `${num} world`;
    const tplNumAsStr = `${num + 10} world`;
    const tplStrAsStr2 = `${str} world ${str} world`;
    console.log(tplStrAsStr);
    console.log(tplNumAsStr);
    console.log(tplStrAsStr2);

    // parameter as tpl str
    console.log(helper('hello', 10));

    // class property as template string
    const a = new A();
    a.x = `${num} and ${str}`;
    console.log(a.y);
    console.log(a.xx);

    console.log(`${A.staticField}`);

    // interface related template string
    const i: I = new A();
    console.log(`${i.x}`);
    console.log(`${i.xx}`);

    // function call as template string
    console.log(`${foo()}`);
    console.log(`${outer()()}`);
    const anyFunc: any = foo;
    console.log(`${anyFunc()}`);

    // array as template string
    const arr = [`${num}`, `2`];
    console.log(arr.toString());
    console.log(`${arr[1]}`);

    // any as template string
    let obj: any = 1;
    console.log(`${obj} is 1`);
    obj = new A();
    console.log(`${obj} is object`);
    obj.dy = 'hi';
    console.log(`${obj.dy} is hi`);
    obj.dz = 0;
    console.log(`${obj.dz} is 0`);
    console.log(`${obj.du} is undefined`);
}

export function stringContainHex() {
    let s: string = "\x41B\x43";
    console.log(s);
}


