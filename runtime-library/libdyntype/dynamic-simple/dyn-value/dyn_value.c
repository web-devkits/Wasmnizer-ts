/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "class/dyn_class.h"
#include "libdyntype_export.h"
#include "pure_dynamic.h"

#define INIT_OBJ_PROPERTY_NUM 4

extern ClassMeta *class_meta_array[DynClassEnd];

static uint32_t
prop_key_hash(const void *key)
{
    return (uint32)(uintptr_t)key;
}

static bool
prop_key_equal(void *h1, void *h2)
{
    return strcmp(h1, h2) == 0 ? true : false;
}

static void
prop_value_destroyer(void *value)
{
    dynamic_release(NULL, (dyn_value_t)value);
}

DynValue *
dyn_value_new_number(double value)
{
    DyntypeNumber *dyn_num =
        (DyntypeNumber *)wasm_runtime_malloc(sizeof(DyntypeNumber));
    if (!dyn_num) {
        return NULL;
    }

    dyn_num->header.type = DynNumber;
    dyn_num->header.class_id = DynClassNumber;
    dyn_num->header.ref_count = 1;
    dyn_num->value = value;

    return (DynValue *)dyn_num;
}

DynValue *
dyn_value_new_boolean(bool value)
{
    DyntypeBoolean *dyn_bool =
        (DyntypeBoolean *)wasm_runtime_malloc(sizeof(DyntypeBoolean));
    if (!dyn_bool) {
        return NULL;
    }

    dyn_bool->header.type = DynBoolean;
    dyn_bool->header.class_id = DynClassBoolean;
    dyn_bool->header.ref_count = 1;
    dyn_bool->value = value;

    return (DynValue *)dyn_bool;
}

DynValue *
dyn_value_new_string(const void *buf, uint32_t length)
{
    uint32 total_size = offsetof(DyntypeString, data) + length + 1;
    DyntypeString *dyn_str = (DyntypeString *)wasm_runtime_malloc(total_size);
    if (!dyn_str) {
        return NULL;
    }
    memset(dyn_str, 0, total_size);

    dyn_str->header.type = DynString;
    dyn_str->header.class_id = DynClassString;
    dyn_str->header.ref_count = 1;
    dyn_str->length = length;
    bh_memcpy_s(dyn_str->data, length, buf, length);

    return (DynValue *)dyn_str;
}

DynValue *
dyn_value_new_undefined()
{
    static DynValue dyn_undefined = {
        .type = DynUndefined,
        .ref_count = 1,
    };

    return &dyn_undefined;
}

DynValue *
dyn_value_new_null()
{
    static DynValue dyn_null = {
        .type = DynNull,
        .ref_count = 1,
    };

    return &dyn_null;
}

bool
init_dyn_object(DyntypeObject *dyn_obj, uint32_t class_id)
{
    dyn_obj->header.type = DynObject;
    dyn_obj->header.class_id = class_id;
    dyn_obj->header.ref_count = 1;
    dyn_obj->properties = bh_hash_map_create(
        INIT_OBJ_PROPERTY_NUM, false, prop_key_hash, prop_key_equal,
        wasm_runtime_free, prop_value_destroyer);
    if (!dyn_obj->properties) {
        return false;
    }

    return true;
}

bool
init_dyn_object_properties(DyntypeObject *dyn_obj)
{
    dyn_obj->properties = bh_hash_map_create(
        INIT_OBJ_PROPERTY_NUM, false, prop_key_hash, prop_key_equal,
        wasm_runtime_free, prop_value_destroyer);
    if (!dyn_obj->properties) {
        return false;
    }

    return true;
}

DynValue *
dyn_value_new_object()
{
    DyntypeObject *dyn_obj =
        (DyntypeObject *)wasm_runtime_malloc(sizeof(DyntypeObject));
    if (!dyn_obj) {
        return NULL;
    }

    if (!init_dyn_object(dyn_obj, DynClassObject)) {
        wasm_runtime_free(dyn_obj);
        return NULL;
    }

    return (DynValue *)dyn_obj;
}

DynValue *
dyn_value_new_array(int len)
{
    uint32_t total_size =
        offsetof(DyntypeArray, data) + len * sizeof(DynValue *);
    DyntypeArray *dyn_array = (DyntypeArray *)wasm_runtime_malloc(total_size);

    memset(dyn_array, 0, total_size);

    if (!init_dyn_object((DyntypeObject *)dyn_array, DynClassArray)) {
        wasm_runtime_free(dyn_array);
        return NULL;
    }

    dyn_array->length = len;

    return (DynValue *)dyn_array;
}

DynValue *
dyn_value_get_global(const char *name)
{
    DynValue *dyn_value = find_global_object(name);

    /* TODO: throw exception */
    assert(dyn_value);

    dyn_value->ref_count++;
    return dyn_value;
}

DynValue *
dyn_value_new_object_with_class(const char *name, int argc,
                                DynValue **args)
{
    DynClassConstructorCallback ctor = find_class_constructor(name);

    /* TODO: throw exception */
    assert(ctor);
    return ctor(argc, args);
}

DynValue *
dyn_value_new_extref(void *ptr, external_ref_tag tag, void *opaque)
{
    DyntypeExtref *dyn_extref =
        (DyntypeExtref *)wasm_runtime_malloc(sizeof(DyntypeExtref));
    if (!dyn_extref) {
        return NULL;
    }

    if (!init_dyn_object((DyntypeObject *)dyn_extref, DynClassExtref)) {
        wasm_runtime_free(dyn_extref);
        return NULL;
    }

    dyn_extref->tag = tag;
    dyn_extref->ref = (int32_t)(uintptr_t)ptr;

    return (DynValue *)dyn_extref;
}

static void
object_property_counter(void *key, void *value, void *user_data)
{
    uint32_t *counter = (uint32_t *)user_data;
    *counter += 1;
}

struct ArraySetter {
    dyn_ctx_t ctx;
    DynValue *dyn_array;
    uint32_t index;
};

static void
object_property_keys(void *key, void *value, void *user_data)
{
    struct ArraySetter *setter_info = (struct ArraySetter *)user_data;
    DynValue *dyn_array = setter_info->dyn_array;
    DynValue *key_string = dyn_value_new_string(key, strlen(key));
    uint32_t index = setter_info->index;

    dynamic_set_elem(NULL, dyn_array, index,
                     key_string);
    /* transfer ownership to the array */
    key_string->ref_count--;
    setter_info->index++;
}

DynValue *
dyn_value_get_keys(DynValue *obj)
{
    uint32_t count = 0;
    DyntypeObject *dyn_obj = (DyntypeObject *)obj;
    DyntypeArray *dyn_array = NULL;
    struct ArraySetter setter_info;

    bh_hash_map_traverse(dyn_obj->properties, object_property_counter, &count);

    dyn_array = (DyntypeArray *)dyn_value_new_array(count);
    if (!dyn_array) {
        return NULL;
    }

    setter_info.dyn_array = (DynValue *)dyn_array;
    setter_info.index = 0;

    bh_hash_map_traverse(dyn_obj->properties, object_property_keys,
                         &setter_info);

    return (DynValue *)dyn_array;
}

DynValue *
dyn_value_invoke(DynValue *obj, const char *name, int argc, DynValue **args)
{
    DynClassMethodCallback f = find_inst_method(obj, name);

    /* TODO: throw exception */
    assert(f);
    return f(obj, argc, args);
}

DynValue *
dyn_value_hold(DynValue *obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    dyn_value->ref_count++;
    return obj;
}

static void
dyn_value_destroy(void *obj)
{
    DynValue *dyn_value = (DynValue *)obj;

    if (dyn_value->type == DynObject) {
        bh_hash_map_destroy(((DyntypeObject *)dyn_value)->properties);

        if (dyn_value->class_id == DynClassArray) {
            uint32 i;
            DyntypeArray *arr = (DyntypeArray *)dyn_value;

            for (i = 0; i < arr->length; i++) {
                if (arr->data[i]) {
                    dyn_value_release(arr->data[i]);
                }
            }
        }
    }

    wasm_runtime_free(dyn_value);
}

void
dyn_value_release(DynValue *obj)
{
    DynValue *dyn_value = (DynValue *)obj;

    if (dyn_value->type == DynUndefined || dyn_value->type == DynNull) {
        return;
    }

    dyn_value->ref_count--;

    if (dyn_value->ref_count == 0) {
        dyn_value_destroy(obj);
    }
}

/* string utilities */
DyntypeString *
dyn_string_concat(DyntypeString *dyn_str1, DyntypeString *dyn_str2)
{
    uint32_t total_size =
        offsetof(DyntypeString, data) + dyn_str1->length + dyn_str2->length + 1;
    DyntypeString *dyn_str = (DyntypeString *)wasm_runtime_malloc(total_size);
    if (!dyn_str) {
        return NULL;
    }
    memset(dyn_str, 0, total_size);

    dyn_str->header.type = DynString;
    dyn_str->header.ref_count = 1;
    dyn_str->header.class_id = DynClassString;
    dyn_str->length = dyn_str1->length + dyn_str2->length;
    bh_memcpy_s(dyn_str->data, dyn_str1->length, dyn_str1->data,
                dyn_str1->length);
    bh_memcpy_s(dyn_str->data + dyn_str1->length, dyn_str2->length,
                dyn_str2->data, dyn_str2->length);

    return dyn_str;
}

int32_t
dyn_string_eq(DyntypeString *dyn_str1, DyntypeString *dyn_str2)
{
    if (dyn_str1 == dyn_str2) {
        return true;
    }

    if (dyn_str1->length != dyn_str2->length) {
        return false;
    }

    return strcmp(dyn_str1->data, dyn_str2->data) == 0 ? true : false;
}

DyntypeString *
dyn_string_slice(DyntypeString *dyn_str, uint32_t start, uint32_t end)
{
    uint32_t total_size, actual_end;
    DyntypeString *dyn_str_res = NULL;

    actual_end = end == UINT32_MAX ? dyn_str->length : end;

    total_size = offsetof(DyntypeString, data) + actual_end - start + 1;
    dyn_str_res = (DyntypeString *)wasm_runtime_malloc(total_size);
    if (!dyn_str_res) {
        return NULL;
    }
    memset(dyn_str_res, 0, total_size);

    dyn_str_res->header.type = DynString;
    dyn_str_res->header.ref_count = 1;
    dyn_str->header.class_id = DynClassString;
    dyn_str_res->length = actual_end - start;
    bh_memcpy_s(dyn_str_res->data, dyn_str_res->length, dyn_str->data + start,
                dyn_str_res->length);

    return dyn_str_res;
}
