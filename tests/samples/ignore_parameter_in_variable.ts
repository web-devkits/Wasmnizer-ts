/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class VNode {
    id: number
    type: string
    constructor(id: number, type: string) {
        this.id = id;
        this.type = type;
      }
}

class Component {
    nodeMap__: { [key: string]: VNode } = { name: { id: 1024, type: "wasm" } }
}

export function test_ignore_parameter() {
    let node: Component = new Component();
    console.log(node.nodeMap__.name.id);    // 1024
    console.log(node.nodeMap__.name.type);  // wasm 
}
