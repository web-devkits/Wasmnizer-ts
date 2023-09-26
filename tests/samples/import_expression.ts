/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import objLiteral from './export_expression_obj_literal'
import numberLiteral from './export_expression_number_literal'

export function defaultObjLiteral() {
    const obj = objLiteral;
    return obj.a;
}

export function defaultNumberLiteral() {
    return numberLiteral;
}
