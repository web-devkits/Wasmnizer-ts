/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#if WASM_ENABLE_STRINGREF != 0
#include "string_object.h"
#endif

#include "type_utils.h"
#include "gc_export.h"
#include "gc_object.h"
#include "libdyntype.h"
#include "wamr_utils.h"
#include "libdyntype_export.h"
#include "quickjs.h"

#define OFFSET_OF_TYPE_ID 0
#define OFFSET_OF_IMPL_ID 4
#define OFFSET_OF_COUNT 8
#define OFFSET_OF_META_FIELDS 12
#define SIZEOF_META_FIELD 12

#define META_FLAG_MASK 0x0000000F
#define META_INDEX_MASK 0xFFFFFFF0

#define OFFSET_OF_FIELD_FLAG_AND_INDEX 4
#define OFFSET_OF_FIELD_TYPE 8

/** start type id of custom type */
#define CUSTOM_TYPE_BEGIN 1052

/*
    utilities for closure object

    * closure struct (WasmGC struct)
    +----------+      +---------------------------+
    | 0:context|----->|           context         |
    +----------+      +---------------------------+
    |  1:thiz  |----->|            thiz           |
    +----------+      +---------------------------+
    |  2:func  |      |            func           |
    +----------+      +---------------------------+
*/
bool
is_ts_closure_type(wasm_module_t wasm_module, wasm_defined_type_t type)
{
    bool is_struct_type;
    wasm_struct_type_t struct_type;
    uint32_t field_count;
    bool mut;
    wasm_ref_type_t field_type;
    uint32_t field_type_idx = 0;
    wasm_defined_type_t field_defined_type;

    is_struct_type = wasm_defined_type_is_struct_type(type);
    if (!is_struct_type) {
        return false;
    }

    struct_type = (wasm_struct_type_t)type;
    field_count = wasm_struct_type_get_field_count(struct_type);

    if (field_count != ENV_PARAM_LEN + 1) {
        return false;
    }
    field_type =
        wasm_struct_type_get_field_type(struct_type, CONTEXT_INDEX, &mut);
    field_type_idx = field_type.heap_type;
    field_defined_type = wasm_get_defined_type(wasm_module, field_type_idx);
    if (!wasm_defined_type_is_struct_type(field_defined_type)) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, THIZ_INDEX, &mut);
    field_type_idx = field_type.heap_type;
    field_defined_type = wasm_get_defined_type(wasm_module, field_type_idx);
    if (!wasm_defined_type_is_struct_type(field_defined_type)) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, FUNC_INDEX, &mut);
    field_type_idx = field_type.heap_type;
    field_defined_type = wasm_get_defined_type(wasm_module, field_type_idx);
    if (!wasm_defined_type_is_func_type(field_defined_type)) {
        return false;
    }

    return true;
}

/*
    utilities for array object

    * array struct (WasmGC struct)
    +----------+      +---------------------------+
    |  0:data  |----->|  content (WasmGC array)   |
    +----------+      +---------------------------+
    |  1:size  |      ^                           ^
    +----------+      |<-------  capacity  ------>|
*/
bool
is_ts_array_type(wasm_module_t wasm_module, wasm_defined_type_t type)
{
    bool is_struct_type;
    wasm_struct_type_t struct_type;
    uint32_t field_count;
    bool mut;
    wasm_ref_type_t field_type;
    uint32_t array_type_idx = 0;
    wasm_defined_type_t array_type;

    is_struct_type = wasm_defined_type_is_struct_type(type);
    if (!is_struct_type) {
        return false;
    }

    struct_type = (wasm_struct_type_t)type;
    field_count = wasm_struct_type_get_field_count(struct_type);

    if (field_count != 2) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, 1, &mut);
    if (field_type.value_type != VALUE_TYPE_I32 || !mut) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, 0, &mut);
    array_type_idx = field_type.heap_type;
    array_type = wasm_get_defined_type(wasm_module, array_type_idx);
    if (!mut || !wasm_defined_type_is_array_type(array_type)) {
        return false;
    }

    return true;
}

uint32_t
get_array_length(wasm_struct_obj_t obj)
{
    wasm_value_t wasm_array_len = { 0 };
    bh_assert(wasm_obj_is_struct_obj((wasm_obj_t)obj));

    wasm_struct_obj_get_field(obj, 1, false, &wasm_array_len);
    return wasm_array_len.u32;
}

wasm_array_obj_t
get_array_ref(wasm_struct_obj_t obj)
{
    wasm_value_t wasm_array = { 0 };
    bh_assert(wasm_obj_is_struct_obj((wasm_obj_t)obj));

    wasm_struct_obj_get_field(obj, 0, false, &wasm_array);
    return (wasm_array_obj_t)wasm_array.gc_obj;
}

int
get_array_capacity(wasm_struct_obj_t obj)
{
    wasm_array_obj_t array_ref = get_array_ref(obj);

    return wasm_array_obj_length(array_ref);
}

uint32_t
get_array_element_size(wasm_array_obj_t obj)
{
    wasm_array_type_t arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)obj);
    return wasm_value_type_size(arr_type->elem_type);
}

int32_t
get_array_type_by_element(wasm_module_t wasm_module,
                          wasm_ref_type_t *element_ref_type, bool is_mutable,
                          wasm_array_type_t *p_array_type)
{
    uint32_t i, type_count;

    type_count = wasm_get_defined_type_count(wasm_module);
    for (i = 0; i < type_count; i++) {
        wasm_defined_type_t type = wasm_get_defined_type(wasm_module, i);
        if (wasm_defined_type_is_array_type(type)) {
            bool mutable;
            wasm_ref_type_t arr_elem_ref_type = wasm_array_type_get_elem_type(
                (wasm_array_type_t)type, &mutable);
            if (wasm_ref_type_equal(&arr_elem_ref_type, element_ref_type,
                                    wasm_module)
                && (mutable == is_mutable)) {
                if (p_array_type) {
                    *p_array_type = (wasm_array_type_t)type;
                }
                return i;
            }
        }
    }

    if (p_array_type) {
        *p_array_type = NULL;
    }
    return -1;
}

int32_t
get_array_struct_type(wasm_module_t wasm_module, int32_t array_type_idx,
                      wasm_struct_type_t *p_struct_type)
{
    uint32_t i, type_count;
    wasm_ref_type_t res_arr_ref_type;

    wasm_ref_type_set_type_idx(&res_arr_ref_type, true, array_type_idx);

    type_count = wasm_get_defined_type_count(wasm_module);
    for (i = 0; i < type_count; i++) {
        wasm_defined_type_t type = wasm_get_defined_type(wasm_module, i);
        if (wasm_defined_type_is_struct_type(type)
            && (wasm_struct_type_get_field_count((wasm_struct_type_t)type)
                == 2)) {
            bool field1_mutable, field2_mutable;
            wasm_ref_type_t first_field_type = wasm_struct_type_get_field_type(
                (wasm_struct_type_t)type, 0, &field1_mutable);
            wasm_ref_type_t second_field_type = wasm_struct_type_get_field_type(
                (wasm_struct_type_t)type, 1, &field2_mutable);
            if (wasm_ref_type_equal(&first_field_type, &res_arr_ref_type,
                                    wasm_module)
                && second_field_type.value_type == VALUE_TYPE_I32) {
                if (p_struct_type) {
                    *p_struct_type = (wasm_struct_type_t)type;
                }
                return i;
            }
        }
    }

    if (p_struct_type) {
        *p_struct_type = NULL;
    }
    return -1;
}

int32_t
get_closure_struct_type(wasm_module_t wasm_module,
                        wasm_struct_type_t *p_struct_type)
{
    uint32_t i, type_count;
    wasm_defined_type_t type;
    wasm_ref_type_t field_type;
    uint32_t field_count_in_ctx = 0;
    wasm_struct_type_t field_defined_type;
    bool mut;

    type_count = wasm_get_defined_type_count(wasm_module);
    for (i = 0; i < type_count; i++) {
        type = wasm_get_defined_type(wasm_module, i);
        if (!is_ts_closure_type(wasm_module, type)) {
            continue;
        }
        field_type = wasm_struct_type_get_field_type((wasm_struct_type_t)type,
                                                     CONTEXT_INDEX, &mut);
        field_defined_type = (wasm_struct_type_t)wasm_get_defined_type(
            wasm_module, field_type.heap_type);
        field_count_in_ctx =
            wasm_struct_type_get_field_count(field_defined_type);
        if (field_count_in_ctx != 0) {
            continue;
        }
        field_type = wasm_struct_type_get_field_type((wasm_struct_type_t)type,
                                                     THIZ_INDEX, &mut);
        field_defined_type = (wasm_struct_type_t)wasm_get_defined_type(
            wasm_module, field_type.heap_type);
        field_count_in_ctx =
            wasm_struct_type_get_field_count(field_defined_type);
        if (field_count_in_ctx != 0) {
            continue;
        }
        if (p_struct_type) {
            *p_struct_type = (wasm_struct_type_t)type;
        }
        return i;
    }
    if (p_struct_type) {
        *p_struct_type = NULL;
    }
    return -1;
}

static uint32_t
get_stringref_array_type(wasm_module_t module, wasm_array_type_t *p_array_type_t)
{
    uint32_t i, type_count;
    bool is_mutable = true;
    type_count = wasm_get_defined_type_count(module);
    for (i = 0; i < type_count; i++) {
        wasm_defined_type_t type = wasm_get_defined_type(module, i);

        if (wasm_defined_type_is_array_type(type)) {
            bool mutable_ref = false;
            wasm_ref_type_t arr_elem_ref_type = wasm_array_type_get_elem_type(
                (wasm_array_type_t)type, &mutable_ref);

            if (arr_elem_ref_type.value_type == VALUE_TYPE_STRINGREF
                && mutable_ref == is_mutable) {
                if (p_array_type_t) {
                    *p_array_type_t = (wasm_array_type_t)type;
                }
                return i;
            }
        }
    }
    if (p_array_type_t) {
        *p_array_type_t = NULL;
    }

    return -1;
}

#if WASM_ENABLE_STRINGREF != 0
wasm_struct_obj_t
create_wasm_array_with_string(wasm_exec_env_t exec_env, void **ptr,
                              uint32_t arrlen)
{
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
    wasm_local_obj_ref_t local_ref = { 0 };
    wasm_array_type_t stringref_array_type = NULL;
    wasm_struct_type_t res_arr_struct_type = NULL;
    wasm_value_t val = { 0 };
    val.gc_obj = NULL;

    uint32_t res_arr_type_idx =
        get_stringref_array_type(module, &stringref_array_type);
    bh_assert(wasm_defined_type_is_array_type(
        (wasm_defined_type_t)stringref_array_type));

    /* get result array struct type */
    get_array_struct_type(module, res_arr_type_idx, &res_arr_struct_type);

    bh_assert(res_arr_struct_type != NULL);
    bh_assert(wasm_defined_type_is_struct_type(
        (wasm_defined_type_t)res_arr_struct_type));

    if (!ptr || !arrlen)
        return NULL;

    /* create new array */
    wasm_array_obj_t new_arr = wasm_array_obj_new_with_type(
        exec_env, stringref_array_type, arrlen, &val);

    if (!new_arr) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }

    /* Push object to local ref to avoid being freed at next allocation */
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    /* create_wasm_string for every element */
    for (int i = 0; i < arrlen; i++) {
        const char *p = (const char *)((void **)ptr)[i];
        void *string_struct = create_wasm_string(exec_env, p);
        val.gc_obj = (wasm_obj_t)string_struct;
        wasm_array_obj_set_elem(new_arr, i, &val);
    }

    wasm_struct_obj_t new_stringref_array_struct =
        wasm_struct_obj_new_with_type(exec_env, res_arr_struct_type);

    if (!new_stringref_array_struct) {
        wasm_runtime_pop_local_object_ref(exec_env);
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "alloc memory failed");
        return NULL;
    }

    val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_stringref_array_struct, 0, &val);

    val.u32 = arrlen;
    wasm_struct_obj_set_field(new_stringref_array_struct, 1, &val);

    wasm_runtime_pop_local_object_ref(exec_env);
    return new_stringref_array_struct;
}
#else
wasm_struct_obj_t
create_wasm_array_with_string(wasm_exec_env_t exec_env, void **ptr,
                              uint32_t arrlen)
{
    uint32_t arr_type_idx, string_type_idx;
    wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 },
                 val = { .gc_obj = NULL };
    wasm_array_type_t res_arr_type = NULL;
    wasm_struct_type_t arr_struct_type = NULL;
    wasm_struct_type_t string_struct_type = NULL;
    wasm_ref_type_t arr_ref_type;
    wasm_array_obj_t new_arr;
    wasm_local_obj_ref_t local_ref;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);

    /* get array type_idx and the element is string */
    string_type_idx = get_string_struct_type(module, &string_struct_type);

    wasm_ref_type_set_type_idx(&arr_ref_type, true, string_type_idx);

    arr_type_idx =
        get_array_type_by_element(module, &arr_ref_type, true, &res_arr_type);
    bh_assert(
        wasm_defined_type_is_array_type((wasm_defined_type_t)res_arr_type));

    /* get result array struct type */
    get_array_struct_type(module, arr_type_idx, &arr_struct_type);
    bh_assert(
        wasm_defined_type_is_struct_type((wasm_defined_type_t)arr_struct_type));

    if (!ptr || !arrlen)
        return NULL;

    /* create new array */
    new_arr =
        wasm_array_obj_new_with_type(exec_env, res_arr_type, arrlen, &init);
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    if (!new_arr) {
        wasm_runtime_pop_local_object_ref(exec_env);
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }

    /* create_wasm_string for every element */
    for (int i = 0; i < arrlen; i++) {
        const char *p = (const char *)((void **)ptr)[i];
        void *string_struct = create_wasm_string(exec_env, p);
        val.gc_obj = (wasm_obj_t)string_struct;
        wasm_array_obj_set_elem(new_arr, i, &val);
    }

    wasm_struct_obj_t string_array_struct =
        wasm_struct_obj_new_with_type(exec_env, arr_struct_type);

    if (!string_array_struct) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }

    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(string_array_struct, 0, &tmp_val);
    tmp_val.u32 = arrlen;
    wasm_struct_obj_set_field(string_array_struct, 1, &tmp_val);

    wasm_runtime_pop_local_object_ref(exec_env);
    return string_array_struct;
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

/* get_array_element_type_with_index */
#define GET_ARRAY_ELEMENT_WITH_INDEX_API(return_value, wasm_type, wasm_field) \
    int get_array_element_##wasm_type##_with_index(                           \
        wasm_struct_obj_t obj, uint32_t idx, return_value *val)               \
    {                                                                         \
        uint32_t len;                                                         \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                        \
        len = get_array_length(obj);                                          \
        if (idx >= 0 && idx < len) {                                          \
            wasm_value_t value = { 0 };                                       \
            wasm_array_obj_get_elem(arr_ref, idx, false, &value);             \
            *val = value.wasm_field;                                          \
            return 1;                                                         \
        }                                                                     \
        return -1;                                                            \
    }

GET_ARRAY_ELEMENT_WITH_INDEX_API(double, f64, f64);
GET_ARRAY_ELEMENT_WITH_INDEX_API(float, f32, f32);
GET_ARRAY_ELEMENT_WITH_INDEX_API(uint64, i64, i64);
GET_ARRAY_ELEMENT_WITH_INDEX_API(uint32, i32, i32);
GET_ARRAY_ELEMENT_WITH_INDEX_API(void *, anyref, gc_obj);

#if WASM_ENABLE_STRINGREF == 0
/*
    utilities for string type

    * string struct (WasmGC struct)
    +----------+
    |  0:flag  |
    +----------+      +---------------------------+
    |  1:data  |----->| content (WasmGC array) |\0|
    +----------+      +---------------------------+
                      ^                        ^
                      |<------  length  ------>|
*/
static bool
is_i8_array(wasm_module_t wasm_module, bool is_mutable,
            wasm_ref_type_t ref_type)
{
    if (ref_type.heap_type >= 0) {
        uint32_t type_idx = ref_type.heap_type;
        wasm_defined_type_t type = wasm_get_defined_type(wasm_module, type_idx);

        if (wasm_defined_type_is_array_type(type)) {
            bool mut;
            wasm_ref_type_t ref_element =
                wasm_array_type_get_elem_type((wasm_array_type_t)type, &mut);
            if (ref_element.value_type == VALUE_TYPE_I8 && mut == is_mutable) {
                return true;
            }
        }
    }

    return false;
}

int32_t
get_string_array_type(wasm_module_t wasm_module,
                      wasm_array_type_t *p_array_type_t)
{
    uint32_t i, type_count;
    bool is_mutable = true;

    type_count = wasm_get_defined_type_count(wasm_module);
    for (i = 0; i < type_count; i++) {
        wasm_defined_type_t type = wasm_get_defined_type(wasm_module, i);

        if (wasm_defined_type_is_array_type(type)) {
            bool mutable;
            wasm_ref_type_t arr_elem_ref_type = wasm_array_type_get_elem_type(
                (wasm_array_type_t)type, &mutable);

            if (arr_elem_ref_type.value_type == VALUE_TYPE_I8
                && mutable == is_mutable) {
                if (p_array_type_t) {
                    *p_array_type_t = (wasm_array_type_t)type;
                }
                return i;
            }
        }
    }

    if (p_array_type_t) {
        *p_array_type_t = NULL;
    }

    return -1;
}

int32_t
get_string_struct_type(wasm_module_t wasm_module,
                       wasm_struct_type_t *p_struct_type)
{
    uint32_t i, type_count;
    wasm_defined_type_t type;

    type_count = wasm_get_defined_type_count(wasm_module);
    for (i = 0; i < type_count; i++) {
        type = wasm_get_defined_type(wasm_module, i);
        if (!is_ts_string_type(wasm_module, type)) {
            continue;
        }
        if (p_struct_type) {
            *p_struct_type = (wasm_struct_type_t)type;
        }
        return i;
    }
    if (p_struct_type) {
        *p_struct_type = NULL;
    }
    return -1;
}

bool
is_ts_string_type(wasm_module_t wasm_module, wasm_defined_type_t type)
{
    bool is_struct_type;
    wasm_struct_type_t struct_type;
    uint32_t field_count;
    bool mut;
    wasm_ref_type_t field_type;

    is_struct_type = wasm_defined_type_is_struct_type(type);
    if (!is_struct_type) {
        return false;
    }

    struct_type = (wasm_struct_type_t)type;
    field_count = wasm_struct_type_get_field_count(struct_type);

    if (field_count != 2) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, 0, &mut);
    if (field_type.value_type != VALUE_TYPE_I32 || !mut) {
        return false;
    }
    field_type = wasm_struct_type_get_field_type(struct_type, 1, &mut);
    if (!mut || !is_i8_array(wasm_module, true, field_type)) {
        return false;
    }

    return true;
}
#endif /* end of WASM_ENABLE_STRINGREF == 0 */

#if WASM_ENABLE_STRINGREF != 0
wasm_stringref_obj_t
create_wasm_string(wasm_exec_env_t exec_env, const char *str)
{
    return wasm_stringref_obj_new(exec_env,
                                  wasm_string_new_const(str, strlen(str)));
}

wasm_stringref_obj_t
create_wasm_string_with_len(wasm_exec_env_t exec_env, const char *str,
                            uint32_t len)
{
    return wasm_stringref_obj_new(
        exec_env, wasm_string_new_with_encoding((void *)str, len, WTF16));
}

uint32_t
wasm_string_get_length(wasm_stringref_obj_t str_obj)
{
    WASMString str = (WASMString)wasm_stringref_obj_get_value(str_obj);
    return wasm_string_encode(str, 0, wasm_string_measure(str, WTF16), NULL,
                              NULL, WTF16);
}

uint32_t
wasm_string_to_cstring(wasm_stringref_obj_t str_obj, char *buffer,
                       uint32_t len)
{
    WASMString str = (WASMString)wasm_stringref_obj_get_value(str_obj);
    uint32_t strlen;
    strlen = wasm_string_encode(str, 0, wasm_string_measure(str, WTF16),
                              (char *)buffer, NULL, WTF16);
    *(char *)(buffer + strlen) = '\0';
    return strlen;
}
#else
wasm_struct_obj_t
create_wasm_string(wasm_exec_env_t exec_env, const char *value)
{
    wasm_struct_type_t string_struct_type = NULL;
    wasm_array_type_t string_array_type = NULL;
    wasm_local_obj_ref_t local_ref = { 0 };
    wasm_value_t val = { 0 };
    wasm_struct_obj_t new_string_struct = NULL;
    wasm_array_obj_t new_arr;
    int len = 0;
    char *p, *p_end;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);

    /* get string len */
    len = strlen(value);

    /* get struct_string_type */
    get_string_struct_type(module, &string_struct_type);
    bh_assert(string_struct_type != NULL);
    bh_assert(wasm_defined_type_is_struct_type(
        (wasm_defined_type_t)string_struct_type));

    /* wrap with string struct */
    new_string_struct =
        wasm_struct_obj_new_with_type(exec_env, string_struct_type);
    if (!new_string_struct) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "alloc memory failed");
        return NULL;
    }

    /* Push object to local ref to avoid being freed at next allocation */
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_string_struct;

    val.i32 = 0;
    get_string_array_type(module, &string_array_type);
    new_arr =
        wasm_array_obj_new_with_type(exec_env, string_array_type, len, &val);
    if (!new_arr) {
        wasm_runtime_pop_local_object_ref(exec_env);
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        return NULL;
    }

    p = (char *)wasm_array_obj_first_elem_addr(new_arr);
    p_end = p + len;
    bh_assert(p);
    bh_assert(p_end);

    bh_memcpy_s(p, len, value, len);
    p += len;
    bh_assert(p == p_end);

    val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_string_struct, 1, &val);

    wasm_runtime_pop_local_object_ref(exec_env);

    (void)p_end;
    return new_string_struct;
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

static wasm_array_obj_t
create_new_array_with_primitive_type(wasm_exec_env_t exec_env,
                                     wasm_struct_type_t *arr_struct_type,
                                     wasm_value_type_t value_type,
                                     bool is_mutable, uint32_t arrlen)
{
    uint32_t i, type_count, arr_type_idx = 0;
    bool mutable;
    wasm_value_t init = { .gc_obj = NULL };
    wasm_array_obj_t new_arr = NULL;
    wasm_local_obj_ref_t local_ref;
    wasm_ref_type_t arr_elem_ref_type;
    wasm_defined_type_t type;
    wasm_struct_type_t struct_type = NULL;
    wasm_array_type_t res_arr_type = NULL;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);

    type_count = wasm_get_defined_type_count(module);
    for (i = 0; i < type_count; i++) {
        type = wasm_get_defined_type(module, i);
        if (!wasm_defined_type_is_array_type(type))
            continue;
        arr_elem_ref_type =
            wasm_array_type_get_elem_type((wasm_array_type_t)type, &mutable);
        if (arr_elem_ref_type.value_type == value_type
            && (mutable == is_mutable)) {
            res_arr_type = (wasm_array_type_t)type;
            arr_type_idx = i;
        }
    }

    bh_assert(
        wasm_defined_type_is_array_type((wasm_defined_type_t)res_arr_type));

    /* get result array struct type */
    get_array_struct_type(module, arr_type_idx, &struct_type);
    bh_assert(
        wasm_defined_type_is_struct_type((wasm_defined_type_t)struct_type));
    *arr_struct_type = struct_type;

    /* create new array */
    new_arr =
        wasm_array_obj_new_with_type(exec_env, res_arr_type, arrlen, &init);
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    if (!new_arr) {
        wasm_runtime_pop_local_object_ref(exec_env);
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }
    wasm_runtime_pop_local_object_ref(exec_env);
    return new_arr;
}

static wasm_struct_obj_t
create_wasm_array_with_type(wasm_exec_env_t exec_env,
                            wasm_value_type_t value_type, void *ptr,
                            uint32_t arrlen)
{
    if (!ptr || !arrlen)
        return NULL;

    wasm_value_t tmp_val = { 0 }, val = { .gc_obj = NULL };
    wasm_struct_type_t arr_struct_type;
    wasm_array_obj_t new_arr = NULL;
    wasm_struct_obj_t new_array_struct;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);

    /* create new array */
    new_arr = create_new_array_with_primitive_type(exec_env, &arr_struct_type,
                                                   value_type, true, arrlen);

    /* traverse each element and assign values ​​to array elements */
    for (int i = 0; i < arrlen; i++) {
        if (value_type == VALUE_TYPE_I32) {
            int32_t ele_val = ((bool *)ptr)[i];
            val.i32 = ele_val;
        }
        else if (value_type == VALUE_TYPE_F64) {
            double ele_val = ((double *)ptr)[i];
            val.f64 = ele_val;
        }
        wasm_array_obj_set_elem(new_arr, i, &val);
    }

    /* create new array struct */
    new_array_struct = wasm_struct_obj_new_with_type(exec_env, arr_struct_type);

    if (!new_array_struct) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }

    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_array_struct, 0, &tmp_val);
    tmp_val.u32 = arrlen;
    wasm_struct_obj_set_field(new_array_struct, 1, &tmp_val);

    return new_array_struct;
}

wasm_struct_obj_t
create_wasm_array_with_i32(wasm_exec_env_t exec_env, void *ptr, uint32_t arrlen)
{
    return create_wasm_array_with_type(exec_env, VALUE_TYPE_I32, ptr, arrlen);
}

wasm_struct_obj_t
create_wasm_array_with_f64(wasm_exec_env_t exec_env, void *ptr, uint32_t arrlen)
{
    return create_wasm_array_with_type(exec_env, VALUE_TYPE_F64, ptr, arrlen);
}

const char *
get_str_from_string_struct(wasm_struct_obj_t obj)
{
    wasm_array_obj_t string_arr = NULL;
    wasm_value_t str_val = { 0 };

    wasm_struct_obj_get_field(obj, 1, false, &str_val);
    string_arr = (wasm_array_obj_t)str_val.gc_obj;
    const char *str = (const char *)wasm_array_obj_first_elem_addr(string_arr);

    return str;
}

uint32_t
get_str_length_from_string_struct(wasm_struct_obj_t obj)
{
    wasm_array_obj_t string_arr = NULL;
    wasm_value_t str_val = { 0 };

    wasm_struct_obj_get_field(obj, 1, false, &str_val);
    string_arr = (wasm_array_obj_t)str_val.gc_obj;

    return wasm_array_obj_length(string_arr);
}

#if WASM_ENABLE_STRINGREF != 0
void *
array_to_string(wasm_exec_env_t exec_env, void *ctx, void *obj, void *separator)
{
    uint32_t len, i;
    wasm_value_t value = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    uint32_t invoke_argc = 0;
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t sep = NULL, concat_str = NULL;
    dyn_value_t *invoke_args = NULL;
    wasm_stringref_obj_t res = NULL;
    bool should_free_sep = false;

    len = get_array_length(obj);

    /* get separator */
    if (separator) {
        sep = (dyn_value_t)wasm_anyref_obj_get_value(
            (wasm_anyref_obj_t)separator);
        if (dyntype_is_undefined(dyn_ctx, sep)) {
            sep = dyntype_new_string(dyn_ctx,
                                     wasm_stringref_obj_get_value(
                                         create_wasm_string(exec_env, ",")));
            should_free_sep = true;
        }
    }
    else {
        sep = dyntype_new_string(
            dyn_ctx,
            wasm_stringref_obj_get_value(create_wasm_string(exec_env, ",")));
        should_free_sep = true;
    }

    invoke_args = wasm_runtime_malloc(len * 2 * sizeof(dyn_value_t));
    if (!invoke_args) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        return NULL;
    }

    for (i = 0; i < len; i++) {
        wasm_array_obj_get_elem(arr_ref, i, 0, &value);
        if (value.gc_obj) {
            if (wasm_obj_is_stringref_obj(value.gc_obj)) {
                invoke_args[invoke_argc++] = dyntype_new_string(
                    dyn_ctx, wasm_stringref_obj_get_value(
                                 (wasm_stringref_obj_t)value.gc_obj));
                invoke_args[invoke_argc++] = sep;
            }
            else {
                wasm_runtime_set_exception(
                    wasm_runtime_get_module_inst(exec_env),
                    "array join for non-string type not implemented");
                goto fail;
            }
        }
    }

    /* Remove tail seperator */
    invoke_argc -= 1;
    invoke_args[invoke_argc] = NULL;

    concat_str = dyntype_invoke(dyn_ctx, "concat", invoke_args[0],
                                invoke_argc - 1, invoke_args + 1);
    if (!concat_str) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "concat string failed");
        goto fail;
    }

    res = wasm_stringref_obj_new(exec_env,
                                 dyntype_to_string(dyn_ctx, concat_str));
    dyntype_release(dyn_ctx, concat_str);

fail:
    if (invoke_args) {
        for (i = 0; i < invoke_argc; i += 2) {
            /* only release created strings, the separator will be released
             * later */
            dyntype_release(dyn_ctx, invoke_args[i]);
        }
        wasm_runtime_free(invoke_args);
    }

    if (should_free_sep) {
        dyntype_release(dyntype_get_context(), sep);
    }

    return res;
}
#else
void *
array_to_string(wasm_exec_env_t exec_env, void *ctx, void *obj, void *separator)
{
    uint32_t len, i, result_len, sep_len;
    uint32_t *string_lengths;
    wasm_value_t value = { 0 }, field1 = { 0 };
    wasm_array_obj_t new_arr, arr_ref = get_array_ref(obj);
    wasm_struct_type_t string_struct_type = NULL;
    wasm_struct_obj_t new_string_struct = NULL;
    wasm_array_type_t string_array_type = NULL;
    wasm_local_obj_ref_t local_ref = { 0 };
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
    char **string_addrs = NULL, *p, *p_end;
    char *sep = NULL;
    wasm_defined_type_t value_defined_type;

    len = get_array_length(obj);

    string_lengths = wasm_runtime_malloc(len * sizeof(uint32));
    if (!string_lengths) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        return NULL;
    }

    string_addrs = wasm_runtime_malloc(len * sizeof(char *));
    if (!string_addrs) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        goto fail;
    }

    /* get separator */
    if (separator) {
        dyn_value_t js_sep = (dyn_value_t)wasm_anyref_obj_get_value(
            (wasm_anyref_obj_t)separator);
        if (!dyntype_is_undefined(ctx, js_sep)) {
            JSValue *js_value = (JSValue *)wasm_anyref_obj_get_value(separator);
            dyntype_to_cstring(dyntype_get_context(), js_value, &sep);
        }
    }

    for (i = 0; i < len; i++) {
        wasm_array_obj_get_elem(arr_ref, i, 0, &value);
        if (!value.gc_obj) {
            string_lengths[i] = 0;
            string_addrs[i] = "";
            continue;
        }
        wasm_struct_obj_get_field((wasm_struct_obj_t)value.gc_obj, 1, false,
                                  &field1);
        value_defined_type =
            wasm_obj_get_defined_type((wasm_obj_t)value.gc_obj);
        if (is_ts_string_type(module, value_defined_type)) {
            wasm_array_obj_t str_array = (wasm_array_obj_t)field1.gc_obj;
            string_lengths[i] = wasm_array_obj_length(str_array);
            string_addrs[i] = wasm_array_obj_first_elem_addr(str_array);
        }
        else {
            wasm_runtime_set_exception(
                wasm_runtime_get_module_inst(exec_env),
                "array join for non-string type not implemented");
            goto fail;
        }
    }

    result_len = 0;
    /* If there is no separator, it will be separated by ',' by default */
    sep_len = sep ? strlen(sep) : strlen(",");
    for (i = 0; i < len; i++) {
        result_len += string_lengths[i] + sep_len;
    }
    if (len >= 1) {
        /* Remove separator after last character */
        result_len -= sep_len;
    }
    /* Create new array for holding string contents */
    value.i32 = 0;
    get_string_array_type(module, &string_array_type);
    new_arr = wasm_array_obj_new_with_type(exec_env, string_array_type,
                                           result_len, &value);
    if (!new_arr) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        goto fail;
    }

    /* Push object to local ref to avoid being freed at next allocation */
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    p = (char *)wasm_array_obj_first_elem_addr(new_arr);
    p_end = p + result_len;
    bh_assert(p);
    bh_assert(p_end);

    for (i = 0; i < len; i++) {
        uint32_t cur_string_len = string_lengths[i];
        bh_memcpy_s(p, p_end - p, string_addrs[i], cur_string_len);
        p += cur_string_len;
        if (i < len - 1) {
            bh_memcpy_s(p, p_end - p, sep ? sep : ",", sep_len);
            p += sep_len;
        }
    }
    bh_assert(p == p_end);

    /* get struct_string_type */
    get_string_struct_type(module, &string_struct_type);
    bh_assert(string_struct_type != NULL);
    bh_assert(wasm_defined_type_is_struct_type(
        (wasm_defined_type_t)string_struct_type));

    /* wrap with string struct */
    new_string_struct =
        wasm_struct_obj_new_with_type(exec_env, string_struct_type);
    if (!new_string_struct) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "alloc memory failed");
        goto fail;
    }

    value.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_string_struct, 1, &value);

fail:
    if (string_lengths) {
        wasm_runtime_free(string_lengths);
    }

    if (string_addrs) {
        wasm_runtime_free(string_addrs);
    }

    if (local_ref.val) {
        wasm_runtime_pop_local_object_ref(exec_env);
    }

    if (sep) {
        dyntype_free_cstring(dyntype_get_context(), sep);
    }

    return new_string_struct;
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

void
get_static_array_info(wasm_exec_env_t exec_env, uint32_t tbl_idx,
                      WasmArrayInfo *p_arr_info)
{
    void *static_arr_struct = NULL;
    wasm_defined_type_t static_arr_arr_type = { 0 };
    bool mutable = false;
    wasm_array_obj_t arr_ref = NULL;
    uint32_t arr_len = 0;
    wasm_ref_type_t arr_elem_ref_type = { 0 };

    static_arr_struct =
        (wasm_struct_obj_t)wamr_utils_get_table_element(exec_env, tbl_idx);
    arr_ref = get_array_ref(static_arr_struct);
    arr_len = get_array_length(static_arr_struct);
    static_arr_arr_type = wasm_obj_get_defined_type((wasm_obj_t)arr_ref);
    arr_elem_ref_type = wasm_array_type_get_elem_type(
        (wasm_array_type_t)static_arr_arr_type, &mutable);

    p_arr_info->ref = arr_ref;
    bh_memcpy_s(&p_arr_info->element_type, sizeof(wasm_ref_type_t),
                &arr_elem_ref_type, sizeof(wasm_ref_type_t));
    p_arr_info->lengh = arr_len;
}

int
get_prop_index_of_struct(wasm_exec_env_t exec_env, const char *prop,
                         wasm_obj_t *wasm_obj, wasm_ref_type_t *field_type)
{
    wasm_module_inst_t module_inst;
    bool is_mut;
    wasm_function_inst_t func;
    wasm_struct_obj_t wasm_struct_obj;
    WASMValue vtable_value = { 0 };
    WASMValue meta = { 0 };
    uint32_t argc = 3, argv[3] = { 0 }, offset;
    wasm_struct_type_t struct_type;
    wasm_struct_type_t vtable_type;
    int property_flag = -1;
    int property_index = -1;

    module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_struct_obj = (wasm_struct_obj_t)(*wasm_obj);
    wasm_struct_obj_get_field(wasm_struct_obj, 0, false, &vtable_value);
    wasm_struct_obj_get_field((wasm_struct_obj_t)vtable_value.gc_obj, 0, false,
                              &meta);
    struct_type = (wasm_struct_type_t)wasm_obj_get_defined_type(*wasm_obj);
    func = wasm_runtime_lookup_function(module_inst,
                                        "find_property_flag_and_index", NULL);
    bh_assert(func);

    argv[0] = meta.i32;
    offset = wasm_runtime_addr_native_to_app(module_inst, (void *)prop);
    argv[1] = offset;
    argv[2] = ALL;

    wasm_runtime_call_wasm(exec_env, func, argc, argv);
    if (argv[0] != -1) {
        property_flag = argv[0] & META_FLAG_MASK;
        property_index = (argv[0] & META_INDEX_MASK) >> 4;
        if (property_flag == METHOD) {
            vtable_type = (wasm_struct_type_t)wasm_obj_get_defined_type(
                vtable_value.gc_obj);
            *field_type = wasm_struct_type_get_field_type(
                vtable_type, property_index, &is_mut);
        }
        else if (property_flag == FIELD) {
            *field_type = wasm_struct_type_get_field_type(
                struct_type, property_index, &is_mut);
        }
    }

    return property_index;
}

/**********Utils for search field value of object through meta
 * information*************/
int32
get_meta_fields_count(void *meta)
{
    return *(int32 *)(meta + OFFSET_OF_COUNT);
}

static inline void *
get_meta_field_by_index(void *meta, int32 index)
{
    return (meta + OFFSET_OF_META_FIELDS + index * SIZEOF_META_FIELD);
}

static inline enum field_flag
get_meta_field_flag(void *meta_field)
{
    int flag = *((int32 *)(meta_field + OFFSET_OF_FIELD_FLAG_AND_INDEX))
               & META_FLAG_MASK;

    return (enum field_flag)flag;
}

static inline int32
get_meta_field_index(void *meta_field)
{
    return (*((int32 *)(meta_field + OFFSET_OF_FIELD_FLAG_AND_INDEX))
            & META_INDEX_MASK)
           >> 4;
}

static inline int32
get_meta_field_type(void *meta_field)
{
    return *((int32 *)(meta_field + OFFSET_OF_FIELD_TYPE));
}

static inline int32
get_meta_field_name(void *meta_field)
{
    return *((int32 *)meta_field);
}

static int32
get_object_field_index_by_mata(wasm_exec_env_t exec_env, void *meta,
                               const char *field_name, enum field_flag flag,
                               ts_value_type_t *field_type)
{
    int32 count;
    void *meta_field;
    enum field_flag meta_field_flag;
    int32 meta_field_name_offset;
    const char *meta_field_name;
    int32 meta_field_index;
    int32 field_type_id;

    count = get_meta_fields_count(meta);
    meta_field_index = -1;

    for (int index = 0; index < count; index++) {
        meta_field = get_meta_field_by_index(meta, index);
        meta_field_flag = get_meta_field_flag(meta_field);
        meta_field_name_offset = get_meta_field_name(meta_field);
        meta_field_name = wasm_runtime_addr_app_to_native(
            wasm_runtime_get_module_inst(exec_env), meta_field_name_offset);

        if (meta_field_flag == flag
            && strcmp(field_name, meta_field_name) == 0) {
            meta_field_index = get_meta_field_index(meta_field);
            if (field_type) {
                field_type_id = get_meta_field_type(meta_field);
                if (field_type_id >= CUSTOM_TYPE_BEGIN) {
                    *field_type = TS_OBJECT;
                }
                else {
                    *field_type = (ts_value_type_t)field_type_id;
                }
            }
            break;
        }
    }

    return meta_field_index;
}

int
get_object_field(wasm_exec_env_t exec_env, wasm_obj_t obj,
                 const char *field_name, enum field_flag flag,
                 ts_value_t *field_value)
{
    void *meta_addr;
    int32 field_index;
    wasm_struct_obj_t vtable_struct;
    WASMValue vtable_value = { 0 };
    wasm_value_t value = { 0 };

    wasm_struct_obj_get_field((wasm_struct_obj_t)obj, 0, false, &vtable_value);
    vtable_struct = (wasm_struct_obj_t)vtable_value.gc_obj;

    /* get meta addr of obj */
    meta_addr = get_meta_of_object(exec_env, obj);

    /* get field index */
    field_index = get_object_field_index_by_mata(
        exec_env, meta_addr, field_name, flag, &field_value->type);
    if (field_index == -1) {
        return -1;
    }

    if (flag == FIELD) {
        wasm_struct_obj_get_field((wasm_struct_obj_t)obj, field_index, false,
                                  &value);
    }
    else {
        wasm_struct_obj_get_field(vtable_struct, field_index, false, &value);
    }

    if (field_value->type == TS_BOOLEAN || field_value->type == TS_INT) {
        field_value->of.i32 = value.i32;
    }
    else if (field_value->type == TS_NUMBER) {
        field_value->of.f64 = value.f64;
    }
    else {
        field_value->of.ref = value.gc_obj;
    }

    return 0;
}

void *
get_meta_of_object(wasm_exec_env_t exec_env, wasm_obj_t obj)
{
    wasm_struct_obj_t struct_obj;
    wasm_struct_obj_t vtable_struct;
    WASMValue vtable_value = { 0 };
    wasm_value_t meta = { 0 };
    void *meta_addr;

    /* get meta addr */
    struct_obj = (wasm_struct_obj_t)obj;
    wasm_struct_obj_get_field(struct_obj, 0, false, &vtable_value);
    vtable_struct = (wasm_struct_obj_t)vtable_value.gc_obj;
    wasm_struct_obj_get_field(vtable_struct, 0, false, &meta);
    meta_addr = wasm_runtime_addr_app_to_native(
        wasm_runtime_get_module_inst(exec_env), meta.i32);
    return meta_addr;
}

const char *
get_field_name_from_meta_index(wasm_exec_env_t exec_env, void *meta,
                               enum field_flag flag, uint32_t index)
{
    int32 count;
    void *meta_field;
    enum field_flag meta_field_flag;
    int32 meta_field_name_offset;
    const char *meta_field_name;

    count = get_meta_fields_count(meta);

    if (index >= 0 && index < count) {
        meta_field = get_meta_field_by_index(meta, index);
        meta_field_flag = get_meta_field_flag(meta_field);
        meta_field_name_offset = get_meta_field_name(meta_field);
        meta_field_name = wasm_runtime_addr_app_to_native(
            wasm_runtime_get_module_inst(exec_env), meta_field_name_offset);
        if (meta_field_name && meta_field_flag == flag)
            return meta_field_name;
    }
    return NULL;
}
