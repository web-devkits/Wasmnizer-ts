/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import defaultNS, { namespaceA as nsA } from './export_namespace';

export function importNamespaceFunc() {
    const nsAResult = nsA.bFunc();
    return nsAResult;
}

export function importNamespaceVar() {
    const nsVar = defaultNS.aVar;
    return nsVar;
}
