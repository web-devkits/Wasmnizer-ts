/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function array_foreach_number() {
    let arr: Array<number> = [123, 234, 456, 4, 453, 0, 456];
    arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
    // console.log(ret); // undefine

}

export function array_foreach_string() {
    let arr: Array<string> = ["s123", "s234", "s456",
        "s4", "s453", "s0", "s456"];
    arr.forEach((val, idx, arr) => {
        console.log(idx, ":", val);
    });
    // console.log(ret); // undefine
}

export function array_foreach_closure() {
    let map: any = new Map()
    let arr = new Array<number>()
    for(let i=0;i<1;i++) {
        arr.push(i)
    }
    arr.forEach((item)=>{
        map.set(item, item)
    })
    return map.size as number
}
