/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

type AttrValue = string | number | boolean

interface AttrObject { [key: string]: AttrValue }

interface StringObject {
    [key: string]: string
}

interface NodeInfo {
    type: string
    attr?: AttrObject
    classList?: Array<string>
    events?: {
        [key: string]: StringObject
    }
    children?: Array<NodeInfo>
}


export function buildNode(): NodeInfo {
    let type: string = "awesome";
    const nodemap: NodeInfo = { type }
    console.log(nodemap.type);  // awesome
    return nodemap              // ref.struct
}

