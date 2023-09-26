/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class MObjectBase {
    id: number

    constructor() {
        this.id = 0;
        console.log("MObjectBase constructor: ", this.id);
    }
}

class MObject<T> extends MObjectBase {
    name: T;

    constructor(name: T) {
        super();
        this.name = name;
        console.log("MObject constructor: ", this.name);
    }
    action(say: T) {
        console.log(say);
    }
}

export function test_GenericClassWithSingleGenericType() {
    const cat = new MObject<string>('cat');
    cat.action('hello');

    const robot = new MObject<number>(12345);
    robot.action(54321);
}

class Generic<X> {
    xxx: X;
    a: number;

    constructor(x: X) {
        this.xxx = x;
        this.a = 0;
        console.log("Generic constructor: ", this.xxx);
    }

    say(x: X) {
        return x;
    }
}

class GenericBase1<X, Y> extends Generic<Y> {
    xx: X;
    yy: Y;

    constructor(x: X, y: Y) {
        super(y);
        this.xx = x;
        this.yy = y;
        console.log("GenericBase1 constructor: ", this.xx, this.yy);
    }
}

class GenericBase2<X> extends Generic<X> {
    xx: X;

    constructor(x: X) {
        super(x);
        this.xx = x;
        console.log("GenericBase2 constructor: ", this.xx);
    }
}

class GenericClass1<X, Y, Z> extends GenericBase1<Z, X> {
    private x: X;

    get value(): X {
        return this.x;
    }
    set value(x: X) {
        if (this.x == x) return;
        this.x = x;
    }
    constructor(x: X, y: Y, z: Z) {
        super(z, x);
        this.x = x;
        console.log("GenericClass1 constructor: ", x, y, z);
    }
    echo(param: X) {
        return param;
    }
}

class GenericClass2<X, Y> extends GenericBase2<Y> {
    private x: X;

    get value(): X {
        return this.x;
    }
    set value(x: X) {
        if (this.x == x) return;
        this.x = x;
    }
    constructor(x: X, y: Y) {
        super(y);
        this.x = x;
        console.log("GenericClass2 constructor: ", x, y);
    }
    echo(param: Y) {
        return param;
    }
}

export function test_GenericClassWithMultipleGenericTypes() {
    const GenericClass_string_number_boolean = new GenericClass1<string, number, boolean>('hello', 1, true);
    GenericClass_string_number_boolean.value = 'world';
    console.log(GenericClass_string_number_boolean.value);
    console.log(GenericClass_string_number_boolean.echo("123"));

    const GenericClass_number_number_number = new GenericClass1<number, number, number>(1, 2, 3);
    GenericClass_number_number_number.value = 11
    console.log(GenericClass_number_number_number.value);
    console.log(GenericClass_number_number_number.echo(111));
}

export function test_GenericClassWithSameBase() {
    const GenericClass_number_string = new GenericClass2<number, string>(1, 'hello');
    GenericClass_number_string.value = 2;
    console.log(GenericClass_number_string.value);
    console.log(GenericClass_number_string.echo("world"));

    const GenericClass_string_number = new GenericClass2<string, number>('world', 11);
    GenericClass_string_number.value = 'hello';
    console.log(GenericClass_string_number.value);
    console.log(GenericClass_string_number.echo(111));
}

interface I<T> {
    getT(): T;
}

interface IGeneric<T, V> extends I<V> {
    iGet(): T;
    iSet(t: T): void;
    echo(v: V): V;
}

class CGeneric<T, V> implements IGeneric<V, T> {
    private t: T;
    private v: V;

    get value(): T {
        return this.t;
    }
    set value(t: T) {
        if (this.t == t) return;
        this.t = t;
    }
    constructor(t: T, v:V) {
        this.t = t;
        this.v = v;
    }
    getT(): T {
        return this.t;
    }
    iGet(): V {
        return this.v;
    }
    iSet(v: V): void {
        this.v = v;
    }
    echo(t: T): T {
        return t;
    }
}

export function test_GenericClassWithImplementsInfc() {
    const generic_class = new CGeneric<string, number>('hello', 1);
    console.log(generic_class.value);
    generic_class.value = 'world';
    console.log(generic_class.value);
    console.log(generic_class.getT());

    generic_class.iSet(2);
    console.log(generic_class.iGet());
    console.log(generic_class.echo('111'));
}

type MyObject<T, U> = {
    a: T;
    b: U;
}

export function test_GenericClassWithTypeAlias() {
    const obj1: MyObject<string, number> = {a: 'John', b: 18};
    console.log(obj1.a);
    console.log(obj1.b);

    const obj2: MyObject<number, boolean> = {a: 123, b: true};
    console.log(obj2.a);
    console.log(obj2.b);
}