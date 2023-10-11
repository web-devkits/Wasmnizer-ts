/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class A {
    _ref: number;
    get ref(): number {
        return this._ref;
    }
    set ref(value: number) {
        this._ref = value;
    }

    constructor(ref_value: number) {
        this._ref = ref_value;
    }
}

class B extends A {
    printRef() {
        console.log(this.ref);   // vtable get
    }
    setRef() {
        this.ref = 888;          // vtable set
    }
    constructor(ref_value: number) {
        super(ref_value);
    }
}

class C extends B {
    private _C_ref = 100;
    set ref(value: number) {
        this._ref = value;
    }
    get ref(): number {
        return this._C_ref;
    }

    constructor(ref_value: number) {
        super(ref_value);
    }
}

export function vtableAccessor() {
    const instance = new B(90);
    instance.printRef();
    instance.setRef();
    instance.printRef();
}
