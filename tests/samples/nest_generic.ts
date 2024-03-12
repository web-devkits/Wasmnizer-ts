/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

// case 1:
// Test when the type of typealias is generic
type ItemGenerator<T, U> = (item: T, index?: U) => void
function func1<T, U>(func: ItemGenerator<U, T>, a: T, b: U) {
    func(b, a);
}

export function test1() {
    const itemGenerator1: ItemGenerator<number, boolean> = (index: number, item?: boolean) => {console.log(index); console.log(item)};
    func1<boolean, number>(itemGenerator1, true, 1);

    const itemGenerator2: ItemGenerator<string, number> = (item: string, index?: number) => {console.log(index); console.log(item)};
    func1<number, string>(itemGenerator2, 2, 'hello');
}

// case 2
// Test when function parameters are generic
class Foo {
    foo<T>(data: T[]) {
        const a = data[0];
        console.log(a);
    }
}
class Bar {
    bar<T>(a: Foo, data: T[]) {
        a.foo(data);
    }
}
class Foo1<T> {
    _x: T;

    constructor(x: T) {
        this._x = x;
    }
    set x(x: T) {
        this._x = x;
    }
    get x() {
        return this._x;
    }
    foo(data: T[]) {
        console.log(this._x);
        console.log(data[0]);
    }
}
class Bar1<U> {
    _y: U;

    constructor(y: U) {
        this._y = y;
    }
    bar(a: Foo1<U>, data: U[]) {
        console.log(this._y);
        a.foo(data);
    }
}
function func2<U>(a: Foo, b: Bar, data: U[]) {
    b.bar(a, data);
}
function func3<U>(a: Foo1<U>, b: Bar1<U>, data: U[]) {
    b.bar(a, data);
}

export function test2() {
    const foo = new Foo();
    const bar = new Bar();
    bar.bar(foo, [1, 2]);
    bar.bar(foo, ['hello', 'world']);
}

export function test3() {
    const foo1 = new Foo1(1);
    foo1.x = 3;
    console.log(foo1.x);
    const bar1 = new Bar1(2);
    bar1.bar(foo1, [1, 2]);

    const foo2 = new Foo1('11');
    foo2.x = '33';
    console.log(foo2.x);
    const bar2 = new Bar1('22');
    bar2.bar(foo2, ['hello', 'world']);
}

export function test4() {
    const a = new Foo();
    const b = new Bar();
    func2(a, b, [1, 2])
    func2(a, b, ['hello', 'world']);

    const c = new Foo1(1);
    const d = new Bar1(2);
    const e = new Foo1('hello');
    const f = new Bar1('world');
    func3(c, d, [3, 4]);
    func3(e, f, ['111', '222']);
}

// case 3
// Test when generic functions are nested
function func5<X, Y>(a: X, b: Y) {
    const foo = new Foo1(a);
    const bar = new Bar1(b);
    console.log(foo.x);
    console.log(bar._y);
}
function func6<U, T>(a: U, b: T) {
    func5(a, b);
}

export function test5() {
    func6(1, 'hello');
    func6(false, 2);
}

// case 4
type funcType<V> = (key: string, value: V) => void
type AttrValue = undefined | string | number | boolean
function echo(key: string, value: string) {
    console.log(key, value);
}

class ArrayMap2<V> {
    readonly keys: string[] = [];
    readonly values: V[] = [];

    get size() {
        return this.keys.length;
    }
    get(key: string): V | undefined {
        const idx = this.keys.indexOf(key)
        if (idx !== -1) {
            return this.values[idx];
        }
        return undefined;
    }
    set(key: string, value: V) {
        const idx = this.keys.indexOf(key);
        if (idx !== -1) {
            this.values[idx] = value;
        } else {
            this.keys.push(key);
            this.values.push(value);
        }
    }
    delete(key: string) {
        const idx = this.keys.indexOf(key);
        if (idx !== -1) {
            this.keys.splice(idx, 1);
            this.values.splice(idx, 1);
        }
    }
    clear() {
        this.keys.splice(0, this.keys.length);
        this.values.splice(0, this.values.length);
    }
    forEach2(fn: funcType<V>) {
        this.keys.forEach((key: string, index: number) => {
            fn(key, this.values[index]);
        })
    }
}

export function test6() {
    const a = new ArrayMap2<number>();
    a.set('n1', 1);
    a.set('n2', 2);
    a.set('n3', 3);
    console.log(a.get('n2'));
    a.delete('n1');
    console.log(a.size);

    const b = new ArrayMap2<string>();
    b.set('s1', '11');
    b.set('s2', '22');
    b.set('s3', '33');
    b.forEach2(echo);
    console.log(b.get('s3'));
    b.clear();
    console.log(b.size);

    const c = new ArrayMap2<AttrValue>();
    c.set('u1', '11');
    c.set('u2', 22);
    c.set('u3', true);
    console.log(c.get('u1'));
    console.log(c.get('u2'));
    console.log(c.get('u3'));
    c.clear();
    console.log(c.size);
}