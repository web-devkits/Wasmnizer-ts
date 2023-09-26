/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function boxStringWithVarStmt() {
    let a: any = 'hello';
    return a;
}

export function boxStringWithBinaryExpr() {
    let a: any;
    a = 'hello';
    return a;
}

export function stringPlusAnyString(){
    let str1: string = 'string1';
    let str2: string = 'string2';
    let str3: string = 'string3';
    
    str2 = str2 + str1;
    console.log(str2);
    str3 = str3 + str2;
    console.log(str3);
}