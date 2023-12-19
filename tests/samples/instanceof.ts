/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    constructor() {
        //
    }
    a() {
        console.log('a');
    }
}

class B extends A {
    b() {
        console.log('b');
    }
}

class C extends B {
    c() {
        console.log('c');
    }
}

class D {
    a() {
        //
    }
    b() {
        //
    }
}
// suitable for B/C
interface I {
    a(): void;
    b(): void;
}

export function instanceofTest() {
    // no need to call native API
    const i: C = new C();
    console.log(i instanceof B);
    const j = new D();
    console.log(j instanceof D);

    console.log(i instanceof D);

    // need to call native API
    let k: I = new B();
    console.log(k instanceof A);
    k = new D();
    console.log(k instanceof A);

    let l: any = new B();
    console.log(l instanceof A);
    l = 1;
    console.log(l instanceof A);
    l = k;
    console.log(l instanceof A);

    k = new B();
    l = k;
    if (l instanceof A) {
        const m = l as A;
        m.a();
    }

    let n: A | D = new C();
    if (n instanceof B) {
        const o = n as B;
        o.b();
        n = new D();
    }
    if (n instanceof B) {
        console.log('n is B');
    }

    const func = () => {
        return k;
    };

    console.log(func instanceof Function);
    console.log(func instanceof Object);
    console.log(func instanceof B);
}

class Base {
}

class Base_1 extends Base {
}

class Base_1_1 extends Base_1 {
}

function leftBaseRightSuperInner(left: Base) {
   if (left instanceof Base_1) {
       console.log('is Base_1')
   }else{
       console.log('is not Base_1')
   }
}

export function leftBaseRightSuper(){
   let aa = new Base_1_1();
   leftBaseRightSuperInner(aa);
}
