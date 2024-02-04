/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "dyn_class.h"

/* Constructor (new Object()) */
DynValue *object_constructor(int argc, DynValue *argv[])
{
    return dyn_value_new_object();
}

DynValue *object_keys(DynValue *this_val, int argc, DynValue *argv[])
{
    return dyn_value_get_keys(argv[0]);
}

ClassMethod object_class_methods[] = { 
    { "keys", object_keys },
    /* TODO: add more methods */
};

ClassMeta object_class_meta = {
    .constructor = object_constructor,
    .parent_class_id = DynClassNone,
    .class_method_num = sizeof(object_class_methods) / sizeof(ClassMethod),
    .class_methods = object_class_methods,
    .name = "Object"
};

/* Object, never free this object */
DyntypeClass object_class = {
    .base = {
        .header = {
            .type = DynObject,
            .class_id = DynClassConstructor,
            .ref_count = 1,
        },
        .properties = NULL,
    },
    .meta = &object_class_meta,
};
