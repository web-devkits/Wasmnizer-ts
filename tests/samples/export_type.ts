/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export type globalType = string;
type globalTypeDefault = number;
export default globalTypeDefault;

export namespace exportTypeNS {
    export type innerType = boolean;
}

export type Pair<T, U> = {
    first: T;
    second: U;
};

export type funcType = () => number;

export type objLiteralType = {
    a: string,
    b: number,
}
