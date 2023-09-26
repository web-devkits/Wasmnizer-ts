/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface StringObject {
    [key: string]: string
}

interface PageInfo {
    name: string
    // template: NodeInfo
    styles: Array<StringObject>
}

export function node_undefined(): string {
    let styles = new Array<StringObject>()
    let a: StringObject = { name: 'level', country: 'China' };
    styles.push(a);
    // let template: NodeInfo = buildNode(ele, styles)

    let page: PageInfo = {
        name: "/Home/index.json",
        // template,
        styles
    }
    const result: string = JSON.stringify(page)
    console.log(page.name);  // /Home/index.json
    return result            // ref.struct
}
