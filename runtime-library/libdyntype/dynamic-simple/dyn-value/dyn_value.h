/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "bh_platform.h"
#include "libdyntype.h"

enum DynValueClass {
    DynClassNone = 0, /* For undefined and null */
    DynClassConstructor = 1,

    DynClassNumber = 10,
    DynClassBoolean,
    DynClassString,
    DynClassObject,
    DynClassArray,
    DynClassExtref,

    DynClassDate,

    DynClassEnd,
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

DynValue *
dyn_value_new_number(double value);

DynValue *
dyn_value_new_boolean(bool value);

DynValue *
dyn_value_new_string(const void *buf, uint32_t length);

DynValue *
dyn_value_new_undefined();

DynValue *
dyn_value_new_null();

bool
init_dyn_object(DyntypeObject *dyn_obj, uint32_t class_id);

bool
init_dyn_object_properties(DyntypeObject *dyn_obj);

DynValue *
dyn_value_new_object();

DynValue *
dyn_value_new_array(int len);

DynValue *
dyn_value_get_global(const char *name);

DynValue *
dyn_value_new_object_with_class(const char *name, int argc,
                                DynValue **args);

DynValue *
dyn_value_new_extref(void *ptr, external_ref_tag tag, void *opaque);

DynValue *
dyn_value_get_keys(DynValue *dyn_obj);

DynValue *
dyn_value_invoke(DynValue *obj, const char *name, int argc, DynValue **args);

DynValue *
dyn_value_hold(DynValue *obj);

void
dyn_value_release(DynValue *obj);

/* string utilities */
DyntypeString *
dyn_string_concat(DyntypeString *dyn_str1, DyntypeString *dyn_str2);

int32_t
dyn_string_eq(DyntypeString *dyn_str1, DyntypeString *dyn_str2);

DyntypeString *
dyn_string_slice(DyntypeString *dyn_str, uint32_t start, uint32_t end);
