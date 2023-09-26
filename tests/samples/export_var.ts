/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export const aVar = 10;
export { bVar, cVar as c };

let bVar = aVar;
bVar += 100;
const cVar = 1000;
