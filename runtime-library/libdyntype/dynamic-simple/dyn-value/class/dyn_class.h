/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "../dyn_value.h"

typedef DynValue * (*DynClassConstructorCallback)(int argc, DynValue **args);
typedef DynValue * (*DynClassMethodCallback)(DynValue *self, int argc, DynValue **args);

typedef struct ClassMethod {
    const char *name;
    DynClassMethodCallback func;
} ClassMethod;

typedef struct ClassMeta {
    const char *name;
    DynClassConstructorCallback constructor;
    uint16_t parent_class_id;
    uint16_t inst_method_num;
    uint16_t class_method_num;
    ClassMethod *inst_methods;
    ClassMethod *class_methods;
} ClassMeta;

/* A special object representing a JavaScript Class value (e.g. Object, Date,
 * JSON) */
typedef struct DyntypeClass {
    DyntypeObject base;
    ClassMeta *meta;
} DyntypeClass;

typedef struct GlobalObjectEntry {
    const char *name;
    DyntypeClass *value;
} GlobalObjectEntry;

DynClassMethodCallback
find_inst_method(DynValue *obj, const char *name);

DynClassConstructorCallback
find_class_constructor(const char *name);

DynValue *
find_global_object(const char *name);
