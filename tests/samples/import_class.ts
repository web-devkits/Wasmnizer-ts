/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { ExportedClass } from './export_class';

class A extends ExportedClass{

}

export function importClass() {
    const ec = new ExportedClass();
    ec.a = 10;
    return ec.a;
}

import DefaultExportClass from './export_class';

let defaultExportClass = new DefaultExportClass();

class TestClass extends DefaultExportClass {
    public bar(x: number) {
        return x * 1;
    }
}

let testClass = new TestClass();

export function importClassAsBaseClass() {
    return TestClass.foo(1) + testClass.bar(2) + defaultExportClass.bar(2);
}

import { BaseI } from './export_class';
interface DerivedInfcI extends BaseI {
    y: string;
}


class DerivedClassI implements BaseI {
    y = "2";
    x = 1;
}

export function importClassAsInterface() {
    let derivedClassI = new DerivedClassI();
    const infc: DerivedInfcI = { x: 1, y: "2"};
    return derivedClassI.x + infc.x;
}
