/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "dyn_class.h"
#include <time.h>

/* Constructor (new Date()) */
DynValue *date_constructor(int argc, DynValue *argv[])
{
    DyntypeObject *dyn_obj =
        (DyntypeObject *)wasm_runtime_malloc(sizeof(DyntypeObject));
    if (!dyn_obj) {
        return NULL;
    }

    if (!init_dyn_object(dyn_obj, DynClassDate)) {
        wasm_runtime_free(dyn_obj);
        return NULL;
    }

    return (DynValue *)dyn_obj;
}

DynValue *date_get_full_year(DynValue *this_val, int argc, DynValue *argv[])
{
    /* TODO */
    return dyn_value_new_undefined();
}

/* Date.prototype.xxx */
ClassMethod date_instance_methods[] = { 
    { "getFullYear", date_get_full_year } 
};

DynValue *date_now(DynValue *this_val, int argc, DynValue *argv[])
{
    // get unix timestamp
    time_t now = time(NULL);
    return dyn_value_new_number((double)now);
}

/* Date.xxx */
ClassMethod date_class_methods[] = { 
    { "now", date_now } 
};

ClassMeta date_class_meta = {
    .constructor = date_constructor,
    .parent_class_id = DynClassObject,
    .inst_method_num = sizeof(date_instance_methods) / sizeof(ClassMethod),
    .inst_methods = date_instance_methods,
    .class_method_num = sizeof(date_class_methods) / sizeof(ClassMethod),
    .class_methods = date_class_methods,
};

/* Date, never free this object */
DyntypeClass date_class = {
    .base = {
        .header = {
            .type = DynObject,
            .class_id = DynClassConstructor,
            .ref_count = 1,
        },
        .properties = NULL,
    },
    .meta = &date_class_meta,
};
