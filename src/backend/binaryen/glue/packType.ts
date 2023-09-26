/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    charArrayTypeInformation,
    stringTypeInformation,
    numberArrayTypeInformation,
    stringArrayTypeInformation,
    boolArrayTypeInformation,
    anyArrayTypeInformation,
    objectStructTypeInformation,
    infcTypeInformation,
    stringArrayStructTypeInformation,
    stringArrayTypeForStringRef,
    stringArrayStructTypeForStringRef,
} from './transform.js';
import { typeInfo } from './utils.js';

export const charArrayTypeInfo: typeInfo = charArrayTypeInformation;
export const stringTypeInfo: typeInfo = stringTypeInformation;
export const numberArrayTypeInfo = numberArrayTypeInformation;
export const stringArrayTypeInfo = stringArrayTypeInformation;
export const stringArrayStructTypeInfo = stringArrayStructTypeInformation;
export const stringArrayTypeInfoForStringRef = stringArrayTypeForStringRef;
export const stringArrayStructTypeInfoForStringRef =
    stringArrayStructTypeForStringRef;
export const boolArrayTypeInfo = boolArrayTypeInformation;
export const anyArrayTypeInfo = anyArrayTypeInformation;
export const objectStructTypeInfo = objectStructTypeInformation;
export const infcTypeInfo = infcTypeInformation;
