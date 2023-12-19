/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "bh_platform.h"

enum DynValueClass {
    DynClassNone = 0, /* For undefined and null */
    DynClassNumber = 10,
    DynClassBoolean,
    DynClassString,
    DynClassObject,
    DynClassArray,
    DynClassExtref,
};

typedef struct DynValue {
    uint8_t type;
    uint8_t class_id;
    uint16_t ref_count;
} DynValue;

typedef struct DyntypeNumber {
    DynValue header;
    double value;
} DyntypeNumber;

typedef struct DyntypeBoolean {
    DynValue header;
    bool value;
} DyntypeBoolean;

typedef struct DyntypeString {
    DynValue header;
    uint32_t length;
    uint8_t data[1];
} DyntypeString;

typedef struct DyntypeObject {
    DynValue header;
    HashMap *properties;
} DyntypeObject;

typedef struct DyntypeArray {
    DyntypeObject base;
    uint32_t length;
    DynValue *data[1];
} DyntypeArray;

typedef struct DyntypeExtref {
    DyntypeObject base;
    int32_t tag;
    int32_t ref;
} DyntypeExtref;
