/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { obj_array } from "./export_implicit_type"

export function getObjTypeFromImport() {
    const obj = obj_array[0];
    console.log(obj.idx);
    console.log(obj.newId);
}