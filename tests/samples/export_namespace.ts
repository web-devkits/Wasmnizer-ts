/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export namespace namespaceA {
    function aFunc() {
        return 10;
    }
    export function bFunc() {
        return aFunc();
    }
}

namespace namespaceB {
    export const aVar = 8;
}

export default namespaceB;
