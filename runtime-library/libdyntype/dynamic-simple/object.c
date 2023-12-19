/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype_export.h"
#include "pure_dynamic.h"
#include "dyn_value.h"
#include <assert.h>

/******************* builtin type compare *******************/
static inline bool
number_cmp(double lhs, double rhs, cmp_operator operator_kind)
{
    bool res = false;

    switch (operator_kind) {
        case LessThanToken:
        {
            res = lhs < rhs;
            break;
        }
        case GreaterThanToken:
        {
            res = lhs > rhs;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = lhs == rhs;
            break;
        }
        case LessThanEqualsToken:
        {
            res = lhs <= rhs;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = lhs >= rhs;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = lhs != rhs;
            break;
        }
    }

    return res;
}

static inline bool
string_cmp(const char *lhs, const char *rhs, cmp_operator operator_kind)
{
    bool res = false;
    int cmp_res = strcmp(lhs, rhs);

    switch (operator_kind) {
        case LessThanToken:
        {
            res = cmp_res < 0;
            break;
        }
        case GreaterThanToken:
        {
            res = cmp_res > 0;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = cmp_res == 0;
            break;
        }
        case LessThanEqualsToken:
        {
            res = cmp_res <= 0;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = cmp_res >= 0;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = cmp_res != 0;
            break;
        }
    }

    return res;
}

static inline bool
bool_cmp(bool lhs, bool rhs, cmp_operator operator_kind)
{
    bool res = false;

    switch (operator_kind) {
        case LessThanToken:
        {
            res = lhs < rhs;
            break;
        }
        case GreaterThanToken:
        {
            res = lhs > rhs;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = lhs == rhs;
            break;
        }
        case LessThanEqualsToken:
        {
            res = lhs <= rhs;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = lhs >= rhs;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = lhs != rhs;
            break;
        }
    }

    return res;
}

static inline bool
cmp_operator_has_equal_token(cmp_operator operator_kind)
{
    if (operator_kind == EqualsEqualsToken
        || operator_kind == EqualsEqualsEqualsToken
        || operator_kind == LessThanEqualsToken
        || operator_kind == GreaterThanEqualsToken) {
        return true;
    }

    return false;
}

/******************* Field access *******************/

dyn_value_t
dynamic_new_number(dyn_ctx_t ctx, double value)
{
    return dyn_value_new_number(value);
}

dyn_value_t
dynamic_new_boolean(dyn_ctx_t ctx, bool value)
{
    return dyn_value_new_boolean(value);
}

dyn_value_t
dynamic_new_string(dyn_ctx_t ctx, const void *stringref)
{
    DynValue *dyn_value = (DynValue *)stringref;
    dyn_value->ref_count++;
    return (dyn_value_t)stringref;
}

dyn_value_t
dynamic_new_undefined(dyn_ctx_t ctx)
{
    return dyn_value_new_undefined();
}

dyn_value_t
dynamic_new_null(dyn_ctx_t ctx)
{
    return dyn_value_new_null();
}

dyn_value_t
dynamic_new_object(dyn_ctx_t ctx)
{
    return dyn_value_new_object();
}

dyn_value_t
dynamic_new_array(dyn_ctx_t ctx, int len)
{
    return dyn_value_new_array(len);
}

dyn_value_t
dynamic_get_global(dyn_ctx_t ctx, const char *name)
{
    return dyn_value_get_global(name);
}

dyn_value_t
dynamic_new_object_with_class(dyn_ctx_t ctx, const char *name, int argc,
                              dyn_value_t *args)
{
    return dyn_value_new_object_with_class(name, argc, (DynValue **)args);
}

dyn_value_t
dynamic_new_extref(dyn_ctx_t ctx, void *ptr, external_ref_tag tag, void *opaque)
{
    return dyn_value_new_extref(ptr, tag, opaque);
}

int
dynamic_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem)
{
    DyntypeArray *dyn_array = (DyntypeArray *)obj;

    if (dyn_array->base.header.type != DynObject
        || dyn_array->base.header.class_id != DynClassArray) {
        return false;
    }

    if (index < 0 || index >= dyn_array->length) {
        return false;
    }

    if (dyn_array->data[index]) {
        dynamic_release(ctx, dyn_array->data[index]);
    }

    dyn_array->data[index] = elem;
    dynamic_hold(ctx, elem);

    return true;
}

dyn_value_t
dynamic_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index)
{
    DyntypeArray *dyn_array = (DyntypeArray *)obj;

    if (dyn_array->base.header.type != DynObject
        || dyn_array->base.header.class_id != DynClassArray) {
        return NULL;
    }

    if (index < 0 || index >= dyn_array->length) {
        return NULL;
    }

    if (!dyn_array->data[index]) {
        return dynamic_new_undefined(ctx);
    }

    ((DynValue *)dyn_array->data[index])->ref_count++;
    return dyn_array->data[index];
}

int
dynamic_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value)
{
    DyntypeObject *dyn_obj = (DyntypeObject *)obj;
    char *key = NULL;

    if (dyn_obj->header.type != DynObject) {
        return false;
    }

    if (!dyn_obj->properties) {
        if (!init_dyn_object_properties(dyn_obj)) {
            return false;
        }
    }

    key = bh_strdup(prop);

    if (!bh_hash_map_find(dyn_obj->properties, (void *)key)) {
        if (!bh_hash_map_insert(dyn_obj->properties, (void *)key, value)) {
            wasm_runtime_free(key);
            return false;
        }
        dynamic_hold(ctx, value);
    }
    else {
        void *old_key;
        DynValue *old_value;

        bh_hash_map_remove(dyn_obj->properties, (void *)key, &old_key,
                           (void **)&old_value);
        wasm_runtime_free(old_key);

        if (!bh_hash_map_insert(dyn_obj->properties, (void *)key, value)) {
            wasm_runtime_free(key);
            return false;
        }

        dynamic_hold(ctx, value);
        dynamic_release(ctx, old_value);
    }

    return true;
}

int
dynamic_define_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                        dyn_value_t desc)
{
    return 0;
}

dyn_value_t
dynamic_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    DyntypeObject *dyn_obj = (DyntypeObject *)obj;
    DynValue *dyn_value = NULL;

    if (dyn_obj->header.type != DynObject) {
        return NULL;
    }

    if (!dyn_obj->properties) {
        return false;
    }

    if (dyn_obj->header.class_id == DynClassArray
        && strcmp(prop, "length") == 0) {
        DyntypeArray *dyn_array = (DyntypeArray *)dyn_obj;
        return dynamic_new_number(ctx, dyn_array->length);
    }

    dyn_value = bh_hash_map_find(dyn_obj->properties, (void *)prop);
    if (dyn_value) {
        dyn_value->ref_count++;
    }
    else {
        return dynamic_new_undefined(ctx);
    }

    return dyn_value;
}

int
dynamic_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    DyntypeObject *dyn_obj = (DyntypeObject *)obj;

    if (dyn_obj->header.type != DynObject) {
        return false;
    }

    if (!dyn_obj->properties) {
        return false;
    }

    if (bh_hash_map_find(dyn_obj->properties, (void *)prop)) {
        return true;
    }

    return false;
}

int
dynamic_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    DyntypeObject *dyn_obj = (DyntypeObject *)obj;
    void *orig_key;
    DynValue *value = NULL;

    if (dyn_obj->header.type != DynObject) {
        return false;
    }

    if (!dyn_obj->properties) {
        return false;
    }

    if (!bh_hash_map_remove(dyn_obj->properties, (void *)prop, &orig_key,
                            (void **)&value)) {
        return false;
    }

    dynamic_release(ctx, value);
    wasm_runtime_free(orig_key);

    return true;
}

dyn_value_t
dynamic_get_keys(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dyn_value_get_keys(obj);
}

/******************* Runtime type checking *******************/

bool
dynamic_is_undefined(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynUndefined ? true : false;
}

bool
dynamic_is_null(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynNull ? true : false;
}

bool
dynamic_is_bool(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynBoolean ? true : false;
}

int
dynamic_to_bool(dyn_ctx_t ctx, dyn_value_t bool_obj, bool *pres)
{
    DynValue *dyn_value = (DynValue *)bool_obj;
    DyntypeBoolean *dyn_bool = (DyntypeBoolean *)dyn_value;

    if (dyn_value->type != DynBoolean) {
        return -DYNTYPE_TYPEERR;
    }

    *pres = dyn_bool->value;
    return DYNTYPE_SUCCESS;
}

bool
dynamic_is_number(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynNumber ? true : false;
}

int
dynamic_to_number(dyn_ctx_t ctx, dyn_value_t obj, double *pres)
{
    DynValue *dyn_value = (DynValue *)obj;
    DyntypeNumber *dyn_num = (DyntypeNumber *)dyn_value;

    if (dyn_value->type != DynNumber) {
        return -DYNTYPE_EXCEPTION;
    }

    *pres = dyn_num->value;
    return DYNTYPE_SUCCESS;
}

bool
dynamic_is_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynString ? true : false;
}

void *
dynamic_to_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    dyn_value->ref_count++;
    return obj;
}

int
dynamic_to_cstring(dyn_ctx_t ctx, dyn_value_t str_obj, char **pres)
{
    DynValue *dyn_value = (DynValue *)str_obj;

    switch (dyn_value->type) {
        case DynString:
        {
            DyntypeString *dyn_str = (DyntypeString *)dyn_value;

            *pres = wasm_runtime_malloc(dyn_str->length + 1);
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }

            bh_memcpy_s(*pres, dyn_str->length + 1, dyn_str->data,
                        dyn_str->length + 1);
            break;
        }
        case DynNumber:
        {
            DyntypeNumber *dyn_num = (DyntypeNumber *)dyn_value;
            double value = dyn_num->value;
            char buf[128];

            if (value - (int64_t)value != 0) {
                snprintf(buf, sizeof(buf), "%.14g", value);
            }
            else {
                snprintf(buf, sizeof(buf), "%"PRId64, (int64_t)value);
            }

            *pres = bh_strdup(buf);
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }
            break;
        }
        case DynBoolean:
        {
            DyntypeBoolean *dyn_bool = (DyntypeBoolean *)dyn_value;

            *pres = bh_strdup(dyn_bool->value ? "true" : "false");
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }
            break;
        }
        case DynUndefined:
        {
            *pres = bh_strdup("undefined");
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }
            break;
        }
        case DynNull:
        {
            *pres = bh_strdup("null");
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }
            break;
        }
        case DynObject:
        {
            *pres = bh_strdup("[object Object]");
            if (!*pres) {
                return -DYNTYPE_EXCEPTION;
            }
            break;
        }
        default:
        {
            return -DYNTYPE_EXCEPTION;
        }
    }

    return DYNTYPE_SUCCESS;
}

void
dynamic_free_cstring(dyn_ctx_t ctx, char *str)
{
    wasm_runtime_free(str);
}

bool
dynamic_is_object(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return dyn_value->type == DynObject ? true : false;
}

bool
dynamic_is_function(dyn_ctx_t ctx, dyn_value_t obj)
{
    return false;
}

bool
dynamic_is_array(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return ((dyn_value->type == DynObject)
            && (dyn_value->class_id == DynClassArray))
               ? true
               : false;
}

bool
dynamic_is_extref(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;
    return (dyn_value->type == DynObject)
                   && (dyn_value->class_id == DynClassExtref)
               ? true
               : false;
}

int
dynamic_to_extref(dyn_ctx_t ctx, dyn_value_t obj, void **pres)
{
    DynValue *dyn_value = (DynValue *)obj;
    DyntypeExtref *dyn_extref = (DyntypeExtref *)dyn_value;

    if (dyn_value->type != DynObject || dyn_value->class_id != DynClassExtref) {
        return -DYNTYPE_TYPEERR;
    }

    *pres = (void *)(uintptr_t)dyn_extref->ref;
    return dyn_extref->tag;
}

bool
dynamic_is_exception(dyn_ctx_t ctx, dyn_value_t value)
{
    return false;
}

bool
dynamic_is_falsy(dyn_ctx_t ctx, dyn_value_t value)
{
    DynValue *obj = (DynValue *)value;

    if (obj->type == DynUndefined || obj->type == DynNull
        || (obj->type == DynBoolean && !((DyntypeBoolean *)obj)->value)
        || (obj->type == DynNumber && !((DyntypeNumber *)obj)->value)
        || (obj->type == DynString && !((DyntypeString *)obj)->length)) {
        return true;
    }

    return false;
}

/******************* Type equivalence *******************/

dyn_type_t
dynamic_typeof(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;

    if (dyn_value->type == DynObject && dyn_value->class_id == DynClassExtref) {
        DyntypeExtref *extref_value = (DyntypeExtref *)dyn_value;
        if (extref_value->tag == ExtObj) {
            return DynExtRefObj;
        }
        else if (extref_value->tag == ExtFunc) {
            return DynExtRefFunc;
        }
        else if (extref_value->tag == ExtArray) {
            return DynExtRefArray;
        }
    }
    return ((DynValue *)obj)->type;
}

bool
dynamic_type_eq(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs)
{
    return ((DynValue *)lhs)->type == ((DynValue *)rhs)->type ? true : false;
}

bool
dynamic_cmp(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs,
            cmp_operator operator_kind)
{
    bool res;
    dyn_type_t type;

    if (lhs == rhs) {
        if (cmp_operator_has_equal_token(operator_kind)) {
            return true;
        }
        else {
            return false;
        }
    }

    type = dynamic_typeof(ctx, lhs);

    switch (type) {
        case DynBoolean:
        {
            bool lhs_b = 0, rhs_b = 0;
            dynamic_to_bool(ctx, lhs, &lhs_b);
            dynamic_to_bool(ctx, rhs, &rhs_b);
            res = bool_cmp(lhs_b, rhs_b, operator_kind);
            break;
        }
        case DynNumber:
        {
            double lhs_n = 0, rhs_n = 0;
            dynamic_to_number(ctx, lhs, &lhs_n);
            dynamic_to_number(ctx, rhs, &rhs_n);
            res = number_cmp(lhs_n, rhs_n, operator_kind);
            break;
        }
        case DynNull:
        {
            if (cmp_operator_has_equal_token(operator_kind)) {
                res = true;
            }
            else {
                res = false;
            }
            break;
        }
        case DynUndefined:
        {
            /** undefined <= undefined => false*/
            if (operator_kind == EqualsEqualsToken
                || operator_kind == EqualsEqualsEqualsToken) {
                res = true;
            }
            else {
                res = false;
            }
            break;
        }

        case DynString:
        {
            char *lhs_s, *rhs_s;
            dynamic_to_cstring(ctx, lhs, &lhs_s);
            dynamic_to_cstring(ctx, rhs, &rhs_s);
            res = string_cmp(lhs_s, rhs_s, operator_kind);
            dynamic_free_cstring(ctx, lhs_s);
            dynamic_free_cstring(ctx, rhs_s);
            break;
        }
        case DynObject:
        {
            /** only allows == / === / != / !== */
            if (operator_kind < EqualsEqualsToken) {
                printf("[runtime library error]: non-equal compare token on "
                       "two any type objects");
            }

            res = lhs == rhs;
            if (operator_kind == ExclamationEqualsToken
                || operator_kind == ExclamationEqualsEqualsToken) {
                res = !res;
            }
            break;
        }
        default:
        {
            res = false;
        }
    }
    return res;
}

/******************* Subtyping *******************/

dyn_value_t
dynamic_new_object_with_proto(dyn_ctx_t ctx, const dyn_value_t proto_obj)
{
    return NULL;
}

int
dynamic_set_prototype(dyn_ctx_t ctx, dyn_value_t obj,
                      const dyn_value_t proto_obj)
{
    return 0;
}

dyn_value_t
dynamic_get_prototype(dyn_ctx_t ctx, dyn_value_t obj)
{
    return NULL;
}

dyn_value_t
dynamic_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    return NULL;
}

bool
dynamic_instanceof(dyn_ctx_t ctx, const dyn_value_t src_obj,
                   const dyn_value_t dst_obj)
{
    return false;
}

/******************* Dumping *******************/

void
dynamic_dump_value(dyn_ctx_t ctx, dyn_value_t obj)
{
    DynValue *dyn_value = (DynValue *)obj;

    switch (dyn_value->type) {
        case DynUndefined:
        {
            printf("undefined");
            break;
        }
        case DynNull:
        {
            printf("null");
            break;
        }
        case DynBoolean:
        {
            printf("%s",
                   ((DyntypeBoolean *)dyn_value)->value ? "true" : "false");
            break;
        }
        case DynNumber:
        {
            double value = ((DyntypeNumber *)dyn_value)->value;
            if (value - (int64_t)value != 0) {
                printf("%.14g", value);
            }
            else {
                printf("%"PRId64, (uint64_t)value);
            }

            break;
        }
        case DynString:
        {
            printf("%s", ((DyntypeString *)dyn_value)->data);
            break;
        }
        case DynObject:
        {
            switch (dyn_value->class_id) {
                case DynClassArray:
                {
                    uint32 i;
                    DyntypeArray *arr = (DyntypeArray *)dyn_value;

                    printf("[");
                    for (i = 0; i < arr->length; i++) {
                        if (arr->data[i]) {
                            dynamic_dump_value(ctx, arr->data[i]);
                        }
                        else {
                            printf("undefined");
                        }

                        if (i < arr->length - 1) {
                            printf(", ");
                        }
                    }
                    printf("]");
                    break;
                }
                case DynClassExtref:
                {
                    printf("[object WasmObject]");
                    break;
                }
                default:
                {
                    printf("[object Object]");
                    break;
                }
            }
            break;
        }
        default:
        {
            printf("[unknown type]");
        }
    }
}

int
dynamic_dump_value_buffer(dyn_ctx_t ctx, dyn_value_t obj, void *buffer, int len)
{
    return 0;
}

void
dynamic_dump_error(dyn_ctx_t ctx)
{}

/******************* Garbage collection *******************/

dyn_value_t
dynamic_hold(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dyn_value_hold(obj);
}

void
dynamic_release(dyn_ctx_t ctx, dyn_value_t obj)
{
    dyn_value_release(obj);
}

void
dynamic_collect(dyn_ctx_t ctx)
{
    // TODO
}

/******************* Exception *******************/

dyn_value_t
dynamic_throw_exception(dyn_ctx_t ctx, dyn_value_t obj)
{
    return NULL;
}

/******************* Special Property Access *******************/

int
dynamic_get_array_length(dyn_ctx_t ctx, dyn_value_t obj)
{
    DyntypeArray *dyn_arr = (DyntypeArray *)obj;

    return dyn_arr->length;
}
