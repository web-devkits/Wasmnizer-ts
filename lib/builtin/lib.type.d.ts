/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

type i32 = any;
type i64 = any;
type f32 = any;
type f64 = any;
type anyref = any;

interface SymbolConstructor {
    readonly iterator: unique symbol;
}
declare var Symbol: SymbolConstructor;

interface Iterable<T> {
    [Symbol.iterator](): Iterator<T>;
}

interface IterableIterator<T> extends Iterator<T> {
    [Symbol.iterator](): IterableIterator<T>;
}

interface ConcatArray<T> {
    readonly length: number;
    readonly [n: number]: T;
    join(separator?: string): string;
    slice(start?: number, end?: number): T[];
}

interface ArrayConstructor {
    new (arrayLength?: number): any[];
    new <T>(arrayLength: number): T[];
    new <T>(...items: T[]): T[];
    (arrayLength?: number): any[];
    <T>(arrayLength: number): T[];
    <T>(...items: T[]): T[];
    isArray(arg: any): arg is any[];
}
declare var Array: ArrayConstructor;

interface Array<T> {
    length: number;
    push(...items: T[]): number;
    pop(): T;
    concat(...items: T[]): T[];

    join(separator?: string): string;

    reverse(): T[];
    shift(): T;
    slice(start?: number, end?: number): T[];
    sort(compareFn: (a: T, b: T) => number): T[]; // change compareFn to required parameter
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
    unshift(...items: T[]): number;
    indexOf(searchElement: T, fromIndex?: number): number;
    lastIndexOf(searchElement: T, fromIndex?: number): number;

    every(predicate: (value: T, index: number, array: T[]) => boolean): boolean;
    some(predicate: (value: T, index: number, array: T[]) => boolean): boolean;

    forEach(callbackfn: (value: T, index: number, array: T[]) => void): void;

    map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];

    filter(predicate: (value: T, index: number, array: T[]) => boolean): T[];

    reduce(
        callbackfn: (
            previousValue: T,
            currentValue: T,
            currentIndex: number,
            array: T[],
        ) => T,
        initialValue: T,
    ): T;

    reduceRight(
        callbackfn: (
            previousValue: T,
            currentValue: T,
            currentIndex: number,
            array: T[],
        ) => T,
        initialValue: T,
    ): T;

    find(predicate: (value: T, index: number, obj: T[]) => boolean): any;

    findIndex(
        predicate: (value: T, index: number, obj: T[]) => boolean,
    ): number;

    fill(value: T, start?: number, end?: number): T[];

    copyWithin(target: number, start: number, end?: number): T[];

    includes(searchElement: T, fromIndex?: number): boolean;

    [n: number]: T;
    [Symbol.iterator](): IterableIterator<T>;
}

interface Boolean {}

interface Number {}

interface Function {}

type CallableFunction = Function;

interface IArguments {
    [index: number]: any;
}

type NewableFunction = Function;

interface Object {}

interface RegExp {}

interface String {
    readonly length: number;
    concat(...strings: string[]): string;
    slice(start?: number, end?: number): string;
    readonly [index: number]: string;
    replace(from: string, to: string): string;
    split(sep: string): string[];
    indexOf(str: string): number;
    lastIndexOf(str: string): number;
    match(pattern: string): string[];
    search(pattern: string): number;
    charAt(index: number): string;
    toLowerCase(): string;
    toUpperCase(): string;
    trim(): string;
    substring(start: number, end?: number): string;
    charCodeAt(index: number): number;
    [Symbol.iterator](): IterableIterator<string>;
}

interface StringConstructor {
    new (value?: any): String;
    (value?: any): string;
    readonly prototype: String;
    fromCharCode(...codes: number[]): string;
}
declare var String: StringConstructor;

interface Math {
    pow(x: number, y: number): number;
    max(...values: number[]): number;
    min(...values: number[]): number;
    sqrt(x: number): number;
    abs(x: number): number;
    ceil(x: number): number;
    floor(x: number): number;
}
declare var Math: Math;

interface TypedPropertyDescriptor<T> {}

interface Console {
    log(...data: any[]): void;
}

declare var console: Console;

interface MapConstructor {
    new (): Map<any, any>;
    set(key: any, value: any): void;
    get(key: any): any;
    has(key: any): boolean;
    size: number;
    delete(key: any): boolean;
    clear(): void;
    forEach(
        callbackfn: (value: any, key: any, map: Map<any, any>) => void,
    ): void;
}
declare var Map: MapConstructor;

interface SetConstructor {
    new (): Set<any>;
    add(key: any): void;
    has(key: any): boolean;
    delete(key: any): boolean;
    clear(): void;
    size: number;
    forEach(callbackfn: (value: any, key: any, map: Set<any>) => void): void;
}
declare var Set: SetConstructor;

interface PromiseConstructor {
    new <T>(
        executor: (
            resolve: (value: T) => void,
            reject: (reason?: any) => void,
        ) => void,
    ): Promise<T>;
    reject<T = never>(reason?: any): Promise<T>;
    resolve(): Promise<void>;
    resolve<T>(value: T): Promise<T>;
}

declare var Promise: PromiseConstructor;

interface DateConstructor {
    new (): Date;
    new (value: number | string): Date;
    new (
        year: number,
        monthIndex: number,
        date?: number,
        hours?: number,
        minutes?: number,
        seconds?: number,
        ms?: number,
    ): Date;
    parse(s: string): number;
    UTC(
        year: number,
        monthIndex: number,
        date?: number,
        hours?: number,
        minutes?: number,
        seconds?: number,
        ms?: number,
    ): number;
    now(): number;
}

declare var Date: DateConstructor;

interface JSON {
    parse(
        text: string,
        reviver?: (this: any, key: string, value: any) => any,
    ): any;
    stringify(
        value: any,
        replacer?: (this: any, key: string, value: any) => any,
        space?: string | number,
    ): any;
    stringify(
        value: any,
        replacer?: (number | string)[] | null,
        space?: string | number,
    ): any;
}

/* JSON will fallback to libdyntype */
declare var JSON: any;

declare var NaN: number;
declare var Infinity: number;

interface Error {
    name: string;
    message: string;
    stack?: string;
}

interface ErrorConstructor {
    new (message?: string): Error;
    (message?: string): Error;
    readonly prototype: Error;
}

declare var Error: ErrorConstructor;

interface Number {
    toString(radix?: number): string;
}

interface Object {
    /** Returns a string representation of an object. */
    toString(): string;
}

interface ObjectConstructor {
    new (value?: any): Object;
    (): any;
    (value: any): any;
}

declare var Object: ObjectConstructor;

interface FunctionConstructor {
    /**
     * Creates a new function.
     * @param args A list of arguments the function accepts.
     */
    new (...args: string[]): Function;
    (...args: string[]): Function;
    readonly prototype: Function;
}

declare var Function: FunctionConstructor;
declare function setTimeout(
    callback: () => void,
    ms: number,
    ...args: any[]
): number;
declare function clearTimeout(timerid: number): void;
