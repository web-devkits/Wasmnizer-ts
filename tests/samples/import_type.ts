/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { Pair, funcType, objLiteralType } from './export_type';
import defaultType, { globalType, exportTypeNS} from './export_re_export';

export function validatePrimitiveType() {
    const defaultValue: defaultType = 100;
    console.log(defaultValue);
    const globalTypeValue: globalType = 'hi';
    console.log(globalTypeValue);
    const nsTypeValue: exportTypeNS.innerType = true;
    console.log(nsTypeValue);
}

export function validateObjType() {
    const obj: objLiteralType = {
        a: 'hello',
        b: 18,
    }
    console.log(obj.a);
    console.log(obj.b);
}

export function validateFuncType() {
    const fn: funcType = () => {return 19};
    return fn();
}

export function validateTypeArguments() {
    const objValue: Pair<number, boolean> = {
        first: 10,
        second: false,
    }
    console.log(objValue.first);
    console.log(objValue.second);
}
