/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function optionalParam(a?: number) {
    return 10;
}

export function testOptionalParam() {
    return optionalParam(1) + optionalParam() + optionalParam(undefined);
}

function optionalParamAndRestParam(a: number, b?: string, ...rest: number[]) {
    return 10;
}

export function testOptionalParamAndRestParam() {
    return optionalParamAndRestParam(1) + optionalParamAndRestParam(1, 'hi') + optionalParamAndRestParam(1, 'hi', 2, 3, 4, 5);
}

class ContainOptionalMethodClass {
    optionalMethod(a?: any) {
        return 20;
    }

    partOptionalMethod(a: any, b?: number) {
        return 20;
    }

    partOptionalDefaultMethod(a: number, b: any = 8, c?: any) {
        return 20;
    }
}

const optionalMethodInst = new ContainOptionalMethodClass();

export function testOptionalMethod() {
    return optionalMethodInst.optionalMethod() + optionalMethodInst.optionalMethod(3);
}

export function testPartOptionalMethod() {
    return optionalMethodInst.partOptionalMethod('hi') + optionalMethodInst.partOptionalMethod('hi', 8);
}

/* TODO: now method don't sopport default parameter, so this case will not success */
/*
export function testPartOptionalDefaultMethod() {
    return optionalMethodInst.partOptionalDefaultMethod(66) + optionalMethodInst.partOptionalDefaultMethod(66, 'hello') + optionalMethodInst.partOptionalDefaultMethod(66, 'hello', true);
}
*/
