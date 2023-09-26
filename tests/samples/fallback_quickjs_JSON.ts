/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

let json = '{"result":true, "count":42}';
let obj = JSON.parse(json);
let str: string = JSON.stringify(obj) as string;
console.log(obj.count);
console.log(str);

export function JSONTest(){
    let json = '{"result":true, "count":42}';
    let obj = JSON.parse(json);
    let str: string = JSON.stringify(obj) as string;
    console.log(obj.count);
    console.log(str);
}

export function JSONTest2(){
    let json = '{"result":true, "count":42}';
    let obj = JSON.parse(json);
    let str: string = JSON.stringify(obj) as string;
    console.log(obj.count);
    console.log(str);
}

export function JSONTest3() {
    let res: any = {
        "'''\'\n\r\t\\1": "2\n",
    }
    let jres1: any = JSON.stringify(res)
    console.log(jres1)
}