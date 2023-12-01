/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    i8ArrayType,
    stringType,
    numberArrayType,
    stringArrayType,
    boolArrayType,
    anyArrayType,
    objectStructType,
    infcType,
    stringArrayStructType,
    stringrefArrayType,
    stringrefArrayStructType,
    arrayBufferType,
    dataViewType,
    numberArrayStructType,
} from './transform.js';
import { typeInfo } from './utils.js';

export const i8ArrayTypeInfo: typeInfo = i8ArrayType;
export const stringTypeInfo: typeInfo = stringType;
export const numberArrayTypeInfo = numberArrayType;
export const stringArrayTypeInfo = stringArrayType;
export const stringArrayStructTypeInfo = stringArrayStructType;
export const stringrefArrayTypeInfo = stringrefArrayType;
export const stringrefArrayStructTypeInfo = stringrefArrayStructType;
export const boolArrayTypeInfo = boolArrayType;
export const anyArrayTypeInfo = anyArrayType;
export const objectStructTypeInfo = objectStructType;
export const infcTypeInfo = infcType;
export const arrayBufferTypeInfo = arrayBufferType;
export const dataViewTypeInfo = dataViewType;
export const numberArrayStructTypeInfo = numberArrayStructType;
