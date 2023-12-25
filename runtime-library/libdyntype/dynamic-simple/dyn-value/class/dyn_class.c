/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "dyn_class.h"

/* How to add new class? */
/*
 *  1. Add a new file in this directory, e.g. "my_class.c"
 *  2. Implement the "constructor", "class methods" and "inst methods" in the
 * created file, refer to date.c
 *  3. Add corresponding entries in this file
 *      - Class meta is mandatory, it is used to create the class instance, or
 * invoke the inst methods (new Date())
 *      - Class object is optional, it is required when you need to invoke the
 * class methods (e.g. Date.now())
 */

/* Class meta (mandatory) */
extern ClassMeta object_class_meta;
extern ClassMeta string_class_meta;
extern ClassMeta date_class_meta;

ClassMeta *class_meta_array[DynClassEnd] = {
    [DynClassNone] = NULL,
    [DynClassNumber] = NULL,
    [DynClassBoolean] = NULL,
    [DynClassString] = &string_class_meta,
    [DynClassObject] = &object_class_meta,
    [DynClassArray] = NULL,
    [DynClassExtref] = NULL,

    [DynClassDate] = &date_class_meta,
};

/* Class object (optional) */
extern DyntypeClass object_class;
extern DyntypeClass date_class;

GlobalObjectEntry global_object_array[]  = {
    { "Object", &object_class },
    { "Date", &date_class },
};

/* Utilities */
static DynClassMethodCallback
find_inst_method_by_classid(uint32_t class_id, const char *name)
{
    ClassMeta *meta = NULL;
    int i;

    if (class_id >= sizeof(class_meta_array)) {
        return NULL;
    }

    meta = class_meta_array[class_id];

    if (!meta)
        return NULL;

    for (i = 0; i < meta->inst_method_num; i++) {
        if (!strcmp(meta->inst_methods[i].name, name))
            return meta->inst_methods[i].func;
    }

    /* Search parent inst method */
    if (meta->parent_class_id != DynClassNone) {
        return find_inst_method_by_classid(meta->parent_class_id, name);
    }

    return NULL;
}

DynClassMethodCallback
find_inst_method(DynValue *obj, const char *name)
{
    if (obj->class_id == DynClassConstructor) {
        uint32_t i;
        ClassMeta *meta = ((DyntypeClass *)obj)->meta;
        if (!meta)
            return NULL;

        for (i = 0; i < meta->class_method_num; i++) {
            if (!strcmp(meta->class_methods[i].name, name))
                return meta->class_methods[i].func;
        }
    }

    return find_inst_method_by_classid(obj->class_id, name);
}

DynClassConstructorCallback
find_class_constructor(const char *name)
{
    ClassMeta *meta = NULL;
    int i;

    for (i = 0; i < DynClassEnd; i++) {
        meta = class_meta_array[i];
        if (!meta)
            continue;

        assert(meta->name != NULL);

        if (!strcmp(meta->name, name))
            return meta->constructor;
    }

    return NULL;
}

DynValue *
find_global_object(const char *name)
{
    int i;

    for (i = 0; i < sizeof(global_object_array) / sizeof(GlobalObjectEntry);
         i++) {
        if (!strcmp(global_object_array[i].name, name))
            return (DynValue *)global_object_array[i].value;
    }

    return NULL;
}
