/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class Foo {
    id = 10;
    children: Array<Foo> = [];
    addChild(child: Foo) {
        // to validate on V8, here does not use push
        // this.children.push(child);
        return child.id;
    }
    static x: Foo = new Foo();
    child: Foo | undefined;
}

export function recursiveType1() {
    const f = new Foo();
    // to validate on V8, here does not use push
    // f.children.push(new Foo());
    f.children = new Array<Foo>(1);
    f.children[0] = new Foo();
    f.addChild(new Foo());
    return f.children[0].id + f.id + Foo.x.id + f.addChild(new Foo());
}

class Foo1 {
    id = 10;
    children: Array<Bar1> = [];
    addChild(child: Bar1) {
        // to validate on V8, here does not use push
        // this.children.push(child);
        return child.id;
    }
    child: Bar1 | undefined;
}

class Bar1 {
    id = 20;
    children: Array<Foo1> = [];
    addChild(child: Foo1) {
        // to validate on V8, here does not use push
        // this.children.push(child);
        return child.id;
    }
    child: Foo1 | undefined;
}

class Baz1 extends Bar1 {
    //
}

export function recursiveType2() {
    const bz = new Baz1();
    bz.children = new Array<Foo1>(1);
    bz.children[0] = new Foo1();
    bz.children[0].children = new Array<Bar1>(1);
    bz.children[0].children[0] = bz;

    const f = new Foo1();

    return bz.children[0].children[0].id + bz.addChild(new Foo1()) + f.addChild(new Bar1());
}
