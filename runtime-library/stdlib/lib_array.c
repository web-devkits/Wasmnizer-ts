/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#if WASM_ENABLE_STRINGREF != 0
#include "string_object.h"
#endif

#include "gc_export.h"
#include "libdyntype_export.h"
#include "object_utils.h"
#include "type_utils.h"

/* When growing an array, allocate more slots to avoid frequent allocation */
#define ARRAY_GROW_REDUNDANCE 16

double
array_push_generic(wasm_exec_env_t exec_env, void *ctx, void *obj, void *value)
{
    uint32_t len, value_len, capacity;
    wasm_array_type_t arr_type;
    wasm_array_obj_t new_arr;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_array_obj_t value_arr_ref = get_array_ref(value);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 };

    len = get_array_length(obj);
    value_len = get_array_length(value);

    capacity = get_array_capacity(obj);

    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);
    if (value_len >= capacity - len) {
        /* Current array space not enough, create new array */
        uint32_t new_len = len + value_len + ARRAY_GROW_REDUNDANCE;
        new_arr =
            wasm_array_obj_new_with_type(exec_env, arr_type, new_len, &init);
        if (!new_arr) {
            wasm_runtime_set_exception(module_inst, "allocate memory failed");
            return 0;
        }

        wasm_array_obj_copy(new_arr, 0, arr_ref, 0, len);
        wasm_array_obj_copy(new_arr, len, value_arr_ref, 0, value_len);

        tmp_val.gc_obj = (wasm_obj_t)new_arr;
        wasm_struct_obj_set_field(obj, 0, &tmp_val);
    }
    else {
        /* Append in current array */
        wasm_array_obj_copy(arr_ref, len, value_arr_ref, 0, value_len);
    }

    /* Update array length */
    tmp_val.u32 = len + value_len;
    wasm_struct_obj_set_field(obj, 1, &tmp_val);

    return (double)(len + value_len);
}

#define ARRAY_POP_API(return_type, wasm_type, wasm_field)                      \
    return_type array_pop_##wasm_type(wasm_exec_env_t exec_env, void *ctx,     \
                                      void *obj)                               \
    {                                                                          \
        uint32_t len;                                                          \
        return_type res;                                                       \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                         \
        wasm_value_t value = { 0 };                                            \
                                                                               \
        len = get_array_length(obj);                                           \
        if (len == 0) {                                                        \
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), \
                                       "array is empty");                      \
            return 0;                                                          \
        }                                                                      \
                                                                               \
        wasm_array_obj_get_elem(arr_ref, len - 1, false, &value);              \
        res = value.wasm_field;                                                \
                                                                               \
        value.u32 = len - 1;                                                   \
        wasm_struct_obj_set_field(obj, 1, &value);                             \
                                                                               \
        return res;                                                            \
    }

ARRAY_POP_API(double, f64, f64)
ARRAY_POP_API(float, f32, f32)
ARRAY_POP_API(uint64, i64, i64)
ARRAY_POP_API(uint32, i32, i32)
ARRAY_POP_API(void *, anyref, gc_obj)

/* The implementation of the basic type must first implement the to_string
 * interface */
#define ARRAY_JOIN_API(return_type, wasm_type, wasm_field)                 \
    void *array_join_##wasm_type(wasm_exec_env_t exec_env, void *ctx,      \
                                 void *obj, void *separator)               \
    {                                                                      \
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), \
                                   "not implemented");                     \
        return NULL;                                                       \
    }

ARRAY_JOIN_API(double, f64, f64)
ARRAY_JOIN_API(float, f32, f32)
ARRAY_JOIN_API(uint64, i64, i64)
ARRAY_JOIN_API(uint32, i32, i32)

/* string type array join interface implementation */
void *
array_join_anyref(wasm_exec_env_t exec_env, void *ctx, void *obj,
                  void *separator)
{
    return array_to_string(exec_env, ctx, obj, separator);
}

/* construct new array struct with new array element, No change to the original
 * array */
void *
array_concat_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                     void *value)
{
    uint32_t len, value_len, new_length = 0;
    wasm_array_type_t arr_type = NULL;
    wasm_array_obj_t new_arr = NULL;
    wasm_struct_type_t struct_type = NULL;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_array_obj_t value_arr_ref = get_array_ref(value);
    wasm_struct_obj_t new_arr_struct = NULL;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 };
    wasm_local_obj_ref_t local_ref;
    bool create_new_array = false;

    len = get_array_length(obj);
    value_len = get_array_length(value);

    struct_type =
        (wasm_struct_type_t)wasm_obj_get_defined_type((wasm_obj_t)obj);

    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);

    if (len == 0 && value_len != 0) {
        new_arr = value_arr_ref;
        new_length = value_len;
    }
    else if (len != 0 && value_len == 0) {
        new_arr = arr_ref;
        new_length = len;
    }
    else {
        new_length = len + value_len;
        new_arr =
            wasm_array_obj_new_with_type(exec_env, arr_type, new_length, &init);
        if (!new_arr) {
            wasm_runtime_set_exception(module_inst, "alloc memory failed");
            return NULL;
        }

        wasm_runtime_push_local_object_ref(exec_env, &local_ref);
        local_ref.val = (wasm_obj_t)new_arr;
        create_new_array = true;

        wasm_array_obj_copy(new_arr, 0, arr_ref, 0, len);
        wasm_array_obj_copy(new_arr, len, value_arr_ref, 0, value_len);
    }

    /* wrap with struct */
    new_arr_struct = wasm_struct_obj_new_with_type(exec_env, struct_type);
    if (!new_arr_struct) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        goto fail;
    }

    /* use new_arr_struct warp new array, and no change orginal array_struct. */
    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_arr_struct, 0, &tmp_val);
    tmp_val.u32 = new_length;
    wasm_struct_obj_set_field(new_arr_struct, 1, &tmp_val);

fail:
    if (create_new_array) {
        wasm_runtime_pop_local_object_ref(exec_env);
    }

    return new_arr_struct;
}

void *
array_reverse_generic(wasm_exec_env_t exec_env, void *ctx, void *obj)
{
    uint32_t i, len;
    wasm_value_t value1 = { 0 }, value2 = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    len = get_array_length(obj);

    if (len == 0) {
        return obj;
    }
    /* The first and last elements of the array are replaced sequentially */
    for (i = 0; i < len / 2; i++) {
        wasm_array_obj_get_elem(arr_ref, i, false, &value1);
        wasm_array_obj_get_elem(arr_ref, len - 1 - i, false, &value2);
        wasm_array_obj_set_elem(arr_ref, i, &value2);
        wasm_array_obj_set_elem(arr_ref, len - 1 - i, &value1);
    }
    return obj;
}

/* Delete and return the first element of the array */
#define ARRAY_SHIFT_API(return_type, wasm_type, wasm_field)                    \
    return_type array_shift_##wasm_type(wasm_exec_env_t exec_env, void *ctx,   \
                                        void *obj)                             \
    {                                                                          \
        uint32_t len;                                                          \
        return_type res;                                                       \
        wasm_array_type_t arr_type;                                            \
        wasm_array_obj_t new_arr;                                              \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                         \
        wasm_module_inst_t module_inst =                                       \
            wasm_runtime_get_module_inst(exec_env);                            \
        wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 },               \
                     value = { 0 };                                            \
                                                                               \
        len = get_array_length(obj);                                           \
        arr_type =                                                             \
            (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref); \
        if (len == 0) {                                                        \
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), \
                                       "array is empty:undefined");            \
        }                                                                      \
        wasm_array_obj_get_elem(arr_ref, 0, false, &value);                    \
        res = value.wasm_field;                                                \
        new_arr =                                                              \
            wasm_array_obj_new_with_type(exec_env, arr_type, len - 1, &init);  \
        if (!new_arr) {                                                        \
            wasm_runtime_set_exception(module_inst, "alloc memory failed");    \
        }                                                                      \
        wasm_array_obj_copy(new_arr, 0, arr_ref, 1, len - 1);                  \
        tmp_val.gc_obj = (wasm_obj_t)new_arr;                                  \
        wasm_struct_obj_set_field(obj, 0, &tmp_val);                           \
        value.u32 = len - 1;                                                   \
        wasm_struct_obj_set_field(obj, 1, &value);                             \
        return res;                                                            \
    }

ARRAY_SHIFT_API(double, f64, f64)
ARRAY_SHIFT_API(float, f32, f32)
ARRAY_SHIFT_API(uint64, i64, i64)
ARRAY_SHIFT_API(uint32, i32, i32)
ARRAY_SHIFT_API(void *, anyref, gc_obj)

void *
array_slice_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                    void *start_obj, void *end_obj)
{
    uint32_t i;
    int32 len, new_len, start, end;
    wasm_struct_obj_t new_arr_struct = NULL;
    wasm_array_obj_t new_arr, arr_ref = get_array_ref(obj);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_struct_type_t struct_type;
    wasm_array_type_t arr_type;
    wasm_value_t init = { 0 }, tmp_val = { 0 };
    wasm_local_obj_ref_t local_ref;
    dyn_value_t start_idx = (dyn_value_t)wasm_anyref_obj_get_value(start_obj);
    dyn_value_t end_idx = (dyn_value_t)wasm_anyref_obj_get_value(end_obj);

    struct_type =
        (wasm_struct_type_t)wasm_obj_get_defined_type((wasm_obj_t)obj);
    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);

    len = get_array_length(obj);
    start = 0;
    end = len;

    if (dyntype_is_number(dyntype_get_context(), start_idx)) {
        double temp;
        dyntype_to_number(dyntype_get_context(), start_idx, &temp);
        start = (int32)temp;
        start = start < 0 ? start + len : start;
        start = start < 0 ? 0 : start;
    }

    if (dyntype_is_number(dyntype_get_context(), end_idx)) {
        double temp;
        dyntype_to_number(dyntype_get_context(), end_idx, &temp);
        end = (int32)temp;
        end = end < 0 ? end + len : end;
        end = end < 0 ? 0 : end;
        end = end > len ? len : end;
    }

    new_len = end - start;
    new_len = new_len < 0 ? 0 : new_len;

    new_arr = wasm_array_obj_new_with_type(exec_env, arr_type, new_len, &init);
    if (!new_arr) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }

    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    for (i = start; i < end; i++) {
        wasm_array_obj_get_elem(arr_ref, i, false, &tmp_val);
        wasm_array_obj_set_elem(new_arr, i - start, &tmp_val);
    }

    new_arr_struct = wasm_struct_obj_new_with_type(exec_env, struct_type);
    if (!new_arr_struct) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        goto end;
    }

    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_arr_struct, 0, &tmp_val);
    tmp_val.u32 = new_len;
    wasm_struct_obj_set_field(new_arr_struct, 1, &tmp_val);

end:
    wasm_runtime_pop_local_object_ref(exec_env);
    return new_arr_struct;
}

void
quick_sort(wasm_exec_env_t exec_env, wasm_array_obj_t arr, int l, int r,
           wasm_func_obj_t closure_func, wasm_value_t context)
{
    int i = l - 1, j = r + 1, pivot_idx = (l + r) >> 1;
    double cmp_res;
    wasm_value_t pivot_elem, elem, tmp_elem, left_elem, right_elem;
    uint32_t argv[6], argc = 0, occupied_slots = 0;
    uint32_t argv_bytes = sizeof(argv),
             pointer_slots = sizeof(void *) / sizeof(uint32);
    uint32_t elem_size, elem_slot;

    if (l >= r)
        return;

    elem_size = 1 << wasm_array_obj_elem_size_log(arr);
    elem_slot = (elem_size + sizeof(uint32) - 1) / sizeof(uint32);
    wasm_array_obj_get_elem(arr, pivot_idx, false, &pivot_elem);

    /* context */
    argc += pointer_slots;
    /* pivot elem */
    argc += elem_slot;
    /* elem */
    argc += elem_slot;

    while (i < j) {
        do {
            occupied_slots = 0;
            i++;
            /* arg0: context */
            bh_memcpy_s(argv, argv_bytes, &(context.gc_obj), sizeof(void *));
            occupied_slots += pointer_slots;
            /* arg1: pivot elem */
            bh_memcpy_s(argv + occupied_slots, argv_bytes - occupied_slots,
                        &pivot_elem.gc_obj, elem_slot * sizeof(uint32));
            occupied_slots += elem_slot;
            /* arg2: elem*/
            wasm_array_obj_get_elem(arr, i, false, &elem);
            bh_memcpy_s(argv + occupied_slots, argv_bytes - occupied_slots,
                        &elem.gc_obj, elem_slot * sizeof(uint32));
            occupied_slots += elem_slot;

            wasm_runtime_call_func_ref(exec_env, closure_func, argc, argv);

            bh_memcpy_s(&cmp_res, sizeof(cmp_res), argv, sizeof(double));
        } while ((i < j) && (cmp_res > 0.0));

        do {
            occupied_slots = 0;
            j--;

            /* arg0: context */
            bh_memcpy_s(argv, argv_bytes, &(context.gc_obj), sizeof(void *));
            occupied_slots += pointer_slots;
            /* arg1: pivot elem*/
            bh_memcpy_s(argv + occupied_slots, argv_bytes - occupied_slots,
                        &pivot_elem.gc_obj, elem_slot * sizeof(uint32));
            occupied_slots += elem_slot;
            /* arg2: elem*/
            wasm_array_obj_get_elem(arr, j, false, &elem);
            bh_memcpy_s(argv + occupied_slots, argv_bytes - occupied_slots,
                        &elem.gc_obj, elem_slot * sizeof(uint32));
            occupied_slots += elem_slot;

            wasm_runtime_call_func_ref(exec_env, closure_func, argc, argv);

            bh_memcpy_s(&cmp_res, sizeof(cmp_res), argv, sizeof(double));
        } while ((i < j) && (cmp_res < 0.0));

        if (i < j) {
            wasm_array_obj_get_elem(arr, i, false, &left_elem);
            wasm_array_obj_get_elem(arr, j, false, &right_elem);
            tmp_elem = left_elem;
            wasm_array_obj_set_elem(arr, i, &right_elem);
            wasm_array_obj_set_elem(arr, j, &tmp_elem);
        }
    }

    quick_sort(exec_env, arr, l, j, closure_func, context);
    quick_sort(exec_env, arr, j + 1, r, closure_func, context);
}

void *
array_sort_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                   void *closure)
{
    uint32_t len;
    wasm_value_t context = { 0 }, func_obj = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);

    len = get_array_length(obj);

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    quick_sort(exec_env, arr_ref, 0, len - 1, (wasm_func_obj_t)func_obj.gc_obj,
               context);

    return obj;
}

void *
array_splice_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                     double start, void *delete_count_obj, void *value)
{
    double delete_count_double;
    int start_idx, delete_count;
    uint32_t len, capacity, value_len = 0, new_len = 0;
    wasm_array_type_t arr_type;
    wasm_array_obj_t new_arr, delete_arr;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_array_obj_t value_arr_ref = NULL;
    wasm_struct_obj_t new_arr_struct = NULL;
    wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 };
    wasm_struct_type_t struct_type =
        (wasm_struct_type_t)wasm_obj_get_defined_type((wasm_obj_t)obj);
    dyn_value_t const delete_count_value =
        (dyn_value_t)wasm_anyref_obj_get_value(delete_count_obj);
    wasm_local_obj_ref_t local_ref;

    if (value
        && !dyntype_is_undefined(dyntype_get_context(), (dyn_value_t)value)) {
        value_arr_ref = get_array_ref(value);
        value_len = get_array_length(value);
    }

    len = get_array_length(obj);
    capacity = get_array_capacity(obj);
    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);
    /* The parameter 'start' may be a decimal, convert it to int */
    start_idx = (int)start;

    /* Ensure that start_idx keeps between 0~len*/
    if (start_idx < 0) {
        if (-start_idx > len) {
            start_idx = 0;
        }
        else {
            start_idx += len;
        }
    }
    else if (start_idx >= len) {
        start_idx = len;
    }

    /* Ensure that delete_count keeps between 0~len */
    delete_count = 0;

    if (dyntype_is_number(dyntype_get_context(), delete_count_value)) {
        dyntype_to_number(dyntype_get_context(), delete_count_value,
                          &delete_count_double);
        delete_count = delete_count_double;
    }
    else if (dyntype_is_undefined(dyntype_get_context(), delete_count_value)) {
        delete_count = len - start;
    }

    delete_count = delete_count < 0 ? 0 : delete_count;
    delete_count =
        start_idx + delete_count > len ? len - start_idx : delete_count;
    delete_arr =
        wasm_array_obj_new_with_type(exec_env, arr_type, delete_count, &init);

    if (!delete_arr) {
        goto end1;
    }

    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)delete_arr;

    /* Copy deleted elements to delete_arr*/
    wasm_array_obj_copy(delete_arr, 0, arr_ref, start_idx, delete_count);

    if (len - delete_count + value_len > capacity) {
        /* Current array space not enough, create new array */
        new_len = len + value_len - delete_count + ARRAY_GROW_REDUNDANCE;
        new_arr =
            wasm_array_obj_new_with_type(exec_env, arr_type, new_len, &init);
        if (!new_arr) {
            goto end2;
        }
        wasm_array_obj_copy(new_arr, 0, arr_ref, 0, start_idx);
        wasm_array_obj_copy(new_arr, start_idx + value_len, arr_ref,
                            start_idx + delete_count,
                            len - delete_count - start_idx);
        if (value_arr_ref && value_len > 0) {
            wasm_array_obj_copy(new_arr, start_idx, value_arr_ref, 0,
                                value_len);
        }
        tmp_val.gc_obj = (wasm_obj_t)new_arr;
        wasm_struct_obj_set_field(obj, 0, &tmp_val);
    }
    else {
        wasm_array_obj_copy(arr_ref, start_idx + value_len, arr_ref,
                            start_idx + delete_count,
                            len - delete_count - start_idx);
        if (value_arr_ref && value_len > 0) {
            wasm_array_obj_copy(arr_ref, start_idx, value_arr_ref, 0,
                                value_len);
        }
    }

    /* Update the length of src array*/
    tmp_val.u32 = len + value_len - delete_count;
    wasm_struct_obj_set_field(obj, 1, &tmp_val);

    /* Wrap delete_arr with struct*/
    new_arr_struct = wasm_struct_obj_new_with_type(exec_env, struct_type);

    if (!new_arr_struct) {
        goto end2;
    }

    tmp_val.gc_obj = (wasm_obj_t)delete_arr;
    wasm_struct_obj_set_field(new_arr_struct, 0, &tmp_val);
    tmp_val.u32 = delete_count;
    wasm_struct_obj_set_field(new_arr_struct, 1, &tmp_val);

    wasm_runtime_pop_local_object_ref(exec_env);
    return new_arr_struct;

end1:
    wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                               "alloc memory failed");
    return NULL;

end2:
    wasm_runtime_pop_local_object_ref(exec_env);
    wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                               "alloc memory failed");
    return NULL;
}

/* Adds one or more elements to the beginning of the array and returns the new
 * length. */
double
array_unshift_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                      void *value)
{
    uint32_t len, value_len, capacity, new_length = 0;
    wasm_array_type_t arr_type;
    wasm_array_obj_t new_arr;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_array_obj_t value_arr_ref = get_array_ref(value);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_value_t init = { .gc_obj = NULL }, tmp_val = { 0 };

    len = get_array_length(obj);
    value_len = get_array_length(value);

    capacity = get_array_capacity(obj);

    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);

    if (len == 0 && value_len != 0) {
        new_arr = value_arr_ref;
        new_length = value_len;
    }
    else if (len != 0 && value_len == 0) {
        new_arr = arr_ref;
        new_length = len;
    }
    else if (value_len >= capacity - len) {
        /* Current array space not enough, create new array */
        uint32_t new_len = len + value_len + ARRAY_GROW_REDUNDANCE;
        new_arr =
            wasm_array_obj_new_with_type(exec_env, arr_type, new_len, &init);
        if (!new_arr) {
            wasm_runtime_set_exception(module_inst, "alloc memory failed");
            return -1;
        }
        wasm_array_obj_copy(new_arr, 0, value_arr_ref, 0, value_len);
        wasm_array_obj_copy(new_arr, value_len, arr_ref, 0, len);
        new_length = len + value_len;
    }
    else {
        wasm_array_obj_copy(arr_ref, value_len, arr_ref, 0, len);
        wasm_array_obj_copy(arr_ref, 0, value_arr_ref, 0, value_len);
        new_arr = arr_ref;
        new_length = len + value_len;
    }
    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(obj, 0, &tmp_val);
    tmp_val.u32 = new_length;
    wasm_struct_obj_set_field(obj, 1, &tmp_val);
    return new_length;
}

/* set from_index_obj, reduce the number of comparisons, default index o start
 */
#define ARRAY_INDEXOF_API(elem_type, wasm_type, wasm_field)               \
    double array_indexOf_##wasm_type(wasm_exec_env_t exec_env, void *ctx, \
                                     void *obj, elem_type element,        \
                                     void *from_index_obj)                \
    {                                                                     \
        int32 len, idx = 0;                                               \
        uint32_t i;                                                       \
        double idx_f = 0;                                                 \
        wasm_value_t tmp_val = { 0 };                                     \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                    \
        dyn_ctx_t dyn_ctx = dyntype_get_context();                        \
        len = get_array_length(obj);                                      \
        if (len == 0) {                                                   \
            return -1;                                                    \
        }                                                                 \
        if (from_index_obj) {                                             \
            dyn_value_t index_obj =                                       \
                (dyn_value_t)wasm_anyref_obj_get_value(from_index_obj);   \
            dyntype_to_number(dyn_ctx, index_obj, &idx_f);                \
            idx = (int32)idx_f;                                           \
        }                                                                 \
        if (idx >= len) {                                                 \
            return -1;                                                    \
        }                                                                 \
        else if (idx < -len) {                                            \
            idx = 0;                                                      \
        }                                                                 \
        else {                                                            \
            idx = idx < 0 ? (idx + len) : idx;                            \
        }                                                                 \
        for (i = idx; i < len; i++) {                                     \
            wasm_array_obj_get_elem(arr_ref, i, false, &tmp_val);         \
            if (tmp_val.wasm_field == element) {                          \
                return i;                                                 \
            }                                                             \
        }                                                                 \
        return -1;                                                        \
    }

ARRAY_INDEXOF_API(double, f64, f64)
ARRAY_INDEXOF_API(float, f32, f32)
ARRAY_INDEXOF_API(uint64, i64, i64)
ARRAY_INDEXOF_API(uint32, i32, i32)

double
array_indexOf_anyref(wasm_exec_env_t exec_env, void *ctx, void *obj,
                     void *element, void *from_index_obj)
{
    int32 len, idx = 0;
    uint32_t i;
    double idx_f = 0;
    wasm_value_t tmp_val = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    dyn_ctx_t dyn_ctx = dyntype_get_context();
#if WASM_ENABLE_STRINGREF == 0
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
#endif

    len = get_array_length(obj);
    if (len == 0)
        return -1;

    if (from_index_obj) {
        dyn_value_t index_obj =
            (dyn_value_t)wasm_anyref_obj_get_value(from_index_obj);
        dyntype_to_number(dyn_ctx, index_obj, &idx_f);
        idx = (int32)idx_f;
    }

    if (idx >= len) {
        return -1;
    }
    else if (idx < -len) {
        idx = 0;
    }
    else {
        idx = idx < 0 ? (idx + len) : idx;
    }

    /* loop through the array */
    for (i = idx; i < len; i++) {
        wasm_defined_type_t value_defined_type;

        wasm_array_obj_get_elem(arr_ref, i, 0, &tmp_val);

#if WASM_ENABLE_STRINGREF != 0
        if (wasm_obj_is_stringref_obj(tmp_val.gc_obj)) {
            if (!wasm_obj_is_stringref_obj(element)) {
                return -1;
            }

            if (string_compare((wasm_stringref_obj_t)tmp_val.gc_obj, element)) {
                return i;
            }

            (void)value_defined_type;
        }
#else
        value_defined_type =
            wasm_obj_get_defined_type((wasm_obj_t)tmp_val.gc_obj);
        if (is_ts_string_type(module, value_defined_type)) {
            wasm_value_t search_string = { 0 }, field1 = { 0 };
            wasm_struct_obj_get_field((wasm_struct_obj_t)tmp_val.gc_obj, 1,
                                      false, &field1);
            wasm_array_obj_t arr2 = (wasm_array_obj_t)field1.gc_obj;
            uint32_t array_element_len = wasm_array_obj_length(arr2);
            void *array_element_ptr = wasm_array_obj_first_elem_addr(arr2);
            wasm_array_obj_t search_string_arr = NULL;
            uint32_t search_string_len = 0;
            void *search_string_ptr = NULL;

            wasm_struct_obj_get_field(element, 1, false, &search_string);
            search_string_arr = (wasm_array_obj_t)search_string.gc_obj;
            /* get search_string array len and addr */
            search_string_len = wasm_array_obj_length(search_string_arr);
            search_string_ptr =
                wasm_array_obj_first_elem_addr(search_string_arr);

            if (search_string_len != array_element_len) {
                continue;
            }

            if (memcmp(search_string_ptr, array_element_ptr, array_element_len)
                    == 0
                && array_element_len == search_string_len) {
                return i;
            }
        }
#endif /* end of WASM_ENABLE_STRINGREF != 0 */
        else {
            if (tmp_val.gc_obj == element)
                return i;
        }
    }

    return -1;
}

/* array_lastIndexOf */
#define ARRAY_LAST_INDEXOF_API(elem_type, wasm_type, wasm_field)              \
    double array_lastIndexOf_##wasm_type(wasm_exec_env_t exec_env, void *ctx, \
                                         void *obj, elem_type element,        \
                                         void *from_index_obj)                \
    {                                                                         \
        int32 i, len, idx = 0;                                                \
        wasm_value_t tmp_val = { 0 };                                         \
        double idx_f = 0;                                                     \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                        \
        dyn_ctx_t dyn_ctx = dyntype_get_context();                            \
        len = get_array_length(obj);                                          \
        if (len == 0) {                                                       \
            return -1;                                                        \
        }                                                                     \
        if (from_index_obj) {                                                 \
            dyn_value_t index_obj =                                           \
                (dyn_value_t)wasm_anyref_obj_get_value(from_index_obj);       \
            dyntype_to_number(dyn_ctx, index_obj, &idx_f);                    \
            idx = (int32)idx_f;                                               \
        }                                                                     \
        if (idx < -len) {                                                     \
            return -1;                                                        \
        }                                                                     \
        else if (idx == 0) {                                                  \
            idx = len - 1;                                                    \
        }                                                                     \
        else {                                                                \
            idx = idx < 0 ? (idx + len) : (idx >= len ? (len - 1) : idx);     \
        }                                                                     \
        for (i = idx; i >= 0; i--) {                                          \
            wasm_array_obj_get_elem(arr_ref, i, false, &tmp_val);             \
            if (tmp_val.wasm_field == element) {                              \
                return i;                                                     \
            }                                                                 \
        }                                                                     \
        return -1;                                                            \
    }

ARRAY_LAST_INDEXOF_API(double, f64, f64)
ARRAY_LAST_INDEXOF_API(float, f32, f32)
ARRAY_LAST_INDEXOF_API(uint64, i64, i64)
ARRAY_LAST_INDEXOF_API(uint32, i32, i32)

double
array_lastIndexOf_anyref(wasm_exec_env_t exec_env, void *ctx, void *obj,
                         void *element, void *from_index_obj)
{
    int32 i, len, idx = 0;
    double idx_f = 0;
    wasm_value_t tmp_val = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    dyn_ctx_t dyn_ctx = dyntype_get_context();
#if WASM_ENABLE_STRINGREF == 0
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
#endif

    len = get_array_length(obj);
    if (len == 0)
        return -1;

    if (from_index_obj) {
        dyn_value_t index_obj =
            (dyn_value_t)wasm_anyref_obj_get_value(from_index_obj);
        dyntype_to_number(dyn_ctx, index_obj, &idx_f);
        idx = (int32)idx_f;
    }

    if (idx < -len) {
        return -1;
    }
    else if (idx == 0) {
        idx = len - 1;
    }
    else {
        idx = idx < 0 ? (idx + len) : (idx >= len ? (len - 1) : idx);
    }

    /* loop through the array */
    for (i = idx; i >= 0; i--) {
        wasm_defined_type_t value_defined_type;

        wasm_array_obj_get_elem(arr_ref, i, 0, &tmp_val);

#if WASM_ENABLE_STRINGREF != 0
        if (wasm_obj_is_stringref_obj(tmp_val.gc_obj)) {
            if (!wasm_obj_is_stringref_obj(element)) {
                return -1;
            }

            if (string_compare((wasm_stringref_obj_t)tmp_val.gc_obj, element)) {
                return i;
            }

            (void)value_defined_type;
        }
#else
        value_defined_type =
            wasm_obj_get_defined_type((wasm_obj_t)tmp_val.gc_obj);

        if (is_ts_string_type(module, value_defined_type)) {
            wasm_value_t field1 = { 0 }, search_string = { 0 };
            wasm_struct_obj_get_field((wasm_struct_obj_t)tmp_val.gc_obj, 1,
                                      false, &field1);
            wasm_array_obj_t arr2 = (wasm_array_obj_t)field1.gc_obj;
            uint32_t array_element_len = wasm_array_obj_length(arr2);
            void *array_element_ptr = wasm_array_obj_first_elem_addr(arr2);

            wasm_struct_obj_get_field(element, 1, false, &search_string);
            wasm_array_obj_t search_string_arr =
                (wasm_array_obj_t)search_string.gc_obj;
            /* get search_string array len and addr */
            uint32_t search_string_len =
                wasm_array_obj_length(search_string_arr);
            void *search_string_ptr =
                wasm_array_obj_first_elem_addr(search_string_arr);

            if (search_string_len != array_element_len) {
                continue;
            }

            if (memcmp(search_string_ptr, array_element_ptr, array_element_len)
                    == 0
                && array_element_len == search_string_len) {
                return i;
            }
        }
#endif /* end of WASM_ENABLE_STRINGREF != 0 */
        else {
            if (tmp_val.gc_obj == element)
                return i;
        }
    }
    return -1;
}

bool
array_every_some_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                         void *closure, bool is_every)
{
    uint32_t i, len, elem_size;
    bool tmp, res = false;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_value_t context = { 0 }, func_obj = { 0 };

    len = get_array_length(obj);
    elem_size = get_array_element_size(arr_ref);

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;
        wasm_value_t element = { 0 };

        wasm_array_obj_get_elem(arr_ref, i, false, &element);
        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
        tmp = argv[0];
        if (!tmp && is_every) {
            return false;
        }
        res = res | tmp;
    }
    return res;
}
bool
array_every_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                    void *closure)
{
    return array_every_some_generic(exec_env, ctx, obj, closure, true);
}

bool
array_some_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                   void *closure)
{
    return array_every_some_generic(exec_env, ctx, obj, closure, false);
}

void
array_forEach_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                      void *closure)
{
    uint32_t i, len, elem_size;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    WASMValue element = { 0 };
    WASMValue context = { 0 }, func_obj = { 0 };
    dyn_ctx_t dyn_ctx;

    dyn_ctx = dyntype_get_context();
    if (!dyn_ctx) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "dynamic context not initialized");
        return;
    }

    len = get_array_length(obj);
    elem_size = get_array_element_size(arr_ref);

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;

        /* Must get arr ref again since it may be changed inside callback */
        arr_ref = get_array_ref(obj);
        wasm_array_obj_get_elem(arr_ref, i, false, &element);

        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
    }
}

void *
array_map_generic(wasm_exec_env_t exec_env, void *ctx, void *obj, void *closure)
{
    uint32_t i, len, elem_size;
    uint32_t res_arr_type_idx;
    wasm_array_obj_t new_arr;
    wasm_struct_obj_t new_arr_struct = NULL;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
    wasm_value_t init = { 0 }, tmp_val = { 0 };
    wasm_func_type_t cb_func_type;
    wasm_ref_type_t cb_ret_ref_type;
    wasm_local_obj_ref_t local_ref;
    wasm_struct_type_t res_arr_struct_type = NULL;
    wasm_array_type_t res_arr_type = NULL;
    wasm_value_t element = { 0 };
    wasm_value_t context = { 0 }, func_obj = { 0 };

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    len = get_array_length(obj);

    /* get callback func return type */
    cb_func_type =
        wasm_func_obj_get_func_type((wasm_func_obj_t)func_obj.gc_obj);
    cb_ret_ref_type = wasm_func_type_get_result_type(cb_func_type, 0);

    /* get result array type */
    res_arr_type_idx = get_array_type_by_element(module, &cb_ret_ref_type, true,
                                                 &res_arr_type);
    bh_assert(
        wasm_defined_type_is_array_type((wasm_defined_type_t)res_arr_type));

    /* get result array struct type */
    get_array_struct_type(module, res_arr_type_idx, &res_arr_struct_type);
    bh_assert(wasm_defined_type_is_struct_type(
        (wasm_defined_type_t)res_arr_struct_type));

    /* create new array */
    new_arr = wasm_array_obj_new_with_type(exec_env, res_arr_type, len, &init);
    if (!new_arr) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        return NULL;
    }
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    /* get current array element type */
    elem_size = get_array_element_size(arr_ref);

    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;

        /* Must get arr ref again since it may be changed inside callback */
        arr_ref = get_array_ref(obj);
        wasm_array_obj_get_elem(arr_ref, i, false, &element);

        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
        wasm_array_obj_set_elem(new_arr, i, (wasm_value_t *)argv);
    }

    /* wrap with struct */
    new_arr_struct =
        wasm_struct_obj_new_with_type(exec_env, res_arr_struct_type);
    if (!new_arr_struct) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        goto end;
    }
    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_arr_struct, 0, &tmp_val);
    tmp_val.u32 = len;
    wasm_struct_obj_set_field(new_arr_struct, 1, &tmp_val);

end:
    wasm_runtime_pop_local_object_ref(exec_env);
    return new_arr_struct;
}

void *
array_filter_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                     void *closure)
{
    uint32_t i, len, elem_size, new_arr_len, include_idx = 0;
    wasm_struct_obj_t new_arr_struct = NULL;
    wasm_array_obj_t new_arr, arr_ref = get_array_ref(obj);
    wasm_struct_type_t struct_type;
    wasm_array_type_t arr_type;
    wasm_local_obj_ref_t local_ref;
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_value_t init = { 0 }, tmp_val = { 0 };
    wasm_obj_t *include_refs = NULL;
    wasm_value_t element = { 0 };
    wasm_value_t context = { 0 }, func_obj = { 0 };

    len = get_array_length(obj);

    struct_type =
        (wasm_struct_type_t)wasm_obj_get_defined_type((wasm_obj_t)obj);
    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);

    elem_size = get_array_element_size(arr_ref);

    /* prepare a buffer to hold included reference */
    include_refs = wasm_runtime_malloc(sizeof(wasm_obj_t) * len);
    if (!include_refs) {
        wasm_runtime_set_exception(module_inst, "alloc memory failed");
        return NULL;
    }

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    memset(include_refs, 0, sizeof(wasm_obj_t) * len);
    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;

        /* Must get arr ref again since it may be changed inside callback */
        arr_ref = get_array_ref(obj);
        wasm_array_obj_get_elem(arr_ref, i, false, &element);

        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
        if (argv[0]) {
            include_refs[include_idx++] = element.gc_obj;
        }
    }

    /* create new array */
    new_arr_len = include_idx;
    new_arr =
        wasm_array_obj_new_with_type(exec_env, arr_type, new_arr_len, &init);
    if (!new_arr) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        goto end1;
    }
    wasm_runtime_push_local_object_ref(exec_env, &local_ref);
    local_ref.val = (wasm_obj_t)new_arr;

    for (i = 0; i < new_arr_len; i++) {
        wasm_value_t elem = { .gc_obj = include_refs[i] };
        wasm_array_obj_set_elem(new_arr, i, &elem);
    }

    /* wrap with struct */
    new_arr_struct = wasm_struct_obj_new_with_type(exec_env, struct_type);
    if (!new_arr_struct) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "alloc memory failed");
        goto end2;
    }
    tmp_val.gc_obj = (wasm_obj_t)new_arr;
    wasm_struct_obj_set_field(new_arr_struct, 0, &tmp_val);
    tmp_val.u32 = new_arr_len;
    wasm_struct_obj_set_field(new_arr_struct, 1, &tmp_val);

end2:
    wasm_runtime_pop_local_object_ref(exec_env);

end1:
    if (include_refs) {
        wasm_runtime_free(include_refs);
    }

    return new_arr_struct;
}

#define ARRAY_REDUCE_COMMON_API(elem_type, wasm_type, wasm_field, is_right,   \
                                underline, name)                              \
    elem_type array_##name##underline##wasm_type(                             \
        wasm_exec_env_t exec_env, void *ctx, void *obj, void *closure,        \
        elem_type initial_value)                                              \
    {                                                                         \
        uint32_t i, len, elem_size;                                           \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                        \
        wasm_value_t previous_value = { 0 };                                  \
        wasm_value_t current_value = { 0 };                                   \
        wasm_value_t context = { 0 }, func_obj = { 0 };                       \
                                                                              \
        len = get_array_length(obj);                                          \
        if (len == 0) {                                                       \
            return initial_value;                                             \
        }                                                                     \
                                                                              \
        previous_value.wasm_field = initial_value;                            \
                                                                              \
        /* get current array element size */                                  \
        elem_size = get_array_element_size(arr_ref);                          \
        /* get closure context and func ref */                                \
        wasm_struct_obj_get_field(closure, 0, false, &context);               \
        wasm_struct_obj_get_field(closure, 1, false, &func_obj);              \
                                                                              \
        for (i = 0; i < len; ++i) {                                           \
            uint32_t idx = i, occupied_slots = 0;                             \
            uint32_t argv[10];                                                \
            uint32_t argc = 10;                                               \
                                                                              \
            if (is_right) {                                                   \
                idx = len - 1 - i;                                            \
            }                                                                 \
                                                                              \
            wasm_array_obj_get_elem(arr_ref, idx, false, &current_value);     \
                                                                              \
            /* prepare args to callback */                                    \
            /* arg0: context */                                               \
            bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *)); \
            occupied_slots += sizeof(void *) / sizeof(uint32);                \
            /* arg1: previous_value */                                        \
            bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, \
                        &previous_value, elem_size);                          \
            occupied_slots += elem_size / sizeof(uint32);                     \
            /* arg2: current_value */                                         \
            bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, \
                        &current_value, elem_size);                           \
            occupied_slots += elem_size / sizeof(uint32);                     \
            /* arg3: the index of current value */                            \
            *(double *)(argv + occupied_slots) = idx;                         \
            occupied_slots += sizeof(double) / sizeof(uint32);                \
            /* arg4: arr */                                                   \
            bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, \
                        &obj, sizeof(void *));                                \
            wasm_runtime_call_func_ref(                                       \
                exec_env, (wasm_func_obj_t)func_obj.gc_obj, argc, argv);      \
                                                                              \
            /* update accumulator */                                          \
            bh_memcpy_s(&previous_value, sizeof(wasm_value_t), argv,          \
                        sizeof(wasm_value_t));                                \
        }                                                                     \
                                                                              \
        return previous_value.wasm_field;                                     \
    }

#define ARRAY_REDUCE_API(elem_type, wasm_type, wasm_field) \
    ARRAY_REDUCE_COMMON_API(elem_type, wasm_type, wasm_field, false, _, reduce)

ARRAY_REDUCE_API(double, f64, f64)
ARRAY_REDUCE_API(float, f32, f32)
ARRAY_REDUCE_API(uint64, i64, i64)
ARRAY_REDUCE_API(uint32, i32, i32)
ARRAY_REDUCE_API(void *, anyref, gc_obj)

#define ARRAY_REDUCE_RIGHT_API(elem_type, wasm_type, wasm_field)       \
    ARRAY_REDUCE_COMMON_API(elem_type, wasm_type, wasm_field, true, _, \
                            reduceRight)

ARRAY_REDUCE_RIGHT_API(double, f64, f64)
ARRAY_REDUCE_RIGHT_API(float, f32, f32)
ARRAY_REDUCE_RIGHT_API(uint64, i64, i64)
ARRAY_REDUCE_RIGHT_API(uint32, i32, i32)
ARRAY_REDUCE_RIGHT_API(void *, anyref, gc_obj)

/* Find the first elements in an array that match the conditions.*/
void *
array_find_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                   void *closure)
{
    uint32_t i, len, elem_size;
    wasm_value_t context = { 0 }, func_obj = { 0 }, element = { 0 };
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_array_type_t arr_type;
    dyn_ctx_t dyn_ctx;
    dyn_value_t found_value;

    dyn_ctx = dyntype_get_context();
    if (!dyn_ctx) {
        wasm_runtime_set_exception((wasm_module_inst_t)module_inst,
                                   "dynamic context not initialized");
        return NULL;
    }

    len = get_array_length(obj);
    arr_type =
        (wasm_array_type_t)wasm_obj_get_defined_type((wasm_obj_t)arr_ref);
    bool is_mut;
    wasm_ref_type_t arr_elem_ref_type =
        wasm_array_type_get_elem_type(arr_type, &is_mut);

    elem_size = get_array_element_size(arr_ref);
    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;

        /* Must get arr ref again since it may be changed inside callback */
        arr_ref = get_array_ref(obj);
        wasm_array_obj_get_elem(arr_ref, i, false, &element);

        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
        if (argv[0]) {
            found_value = box_value_to_any(exec_env, dyn_ctx, &element,
                                           arr_elem_ref_type, false, -1);
            RETURN_BOX_ANYREF(found_value, dyn_ctx);
            break;
        }
    }

    RETURN_BOX_ANYREF(dyntype_new_undefined(dyn_ctx), dyn_ctx);
}

double
array_findIndex_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                        void *closure)
{
    uint32_t i, len, elem_size;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    wasm_value_t element = { 0 };
    wasm_value_t context = { 0 }, func_obj = { 0 };

    len = get_array_length(obj);

    elem_size = get_array_element_size(arr_ref);

    /* get closure context and func ref */
    wasm_struct_obj_get_field(closure, 0, false, &context);
    wasm_struct_obj_get_field(closure, 1, false, &func_obj);

    /* invoke callback function */
    for (i = 0; i < len; i++) {
        uint32_t argv[10];
        uint32_t argc = 8;
        uint32_t occupied_slots = 0;

        /* Must get arr ref again since it may be changed inside callback */
        arr_ref = get_array_ref(obj);
        wasm_array_obj_get_elem(arr_ref, i, false, &element);

        /* prepare args to callback */
        /* arg0: context */
        bh_memcpy_s(argv, sizeof(argv), &context.gc_obj, sizeof(void *));
        occupied_slots += sizeof(void *) / sizeof(uint32);
        /* arg1: element */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots,
                    &element, elem_size);
        occupied_slots += elem_size / sizeof(uint32);
        /* arg2: index */
        *(double *)(argv + occupied_slots) = i;
        occupied_slots += sizeof(double) / sizeof(uint32);
        /* arg3: arr */
        bh_memcpy_s(argv + occupied_slots, sizeof(argv) - occupied_slots, &obj,
                    sizeof(void *));

        wasm_runtime_call_func_ref(exec_env, (wasm_func_obj_t)func_obj.gc_obj,
                                   argc, argv);
        if (argv[0]) {
            return i;
        }
    }

    return -1;
}

#define ARRAY_FILL_API(elem_type, wasm_type, wasm_field)                       \
    void *array_fill_##wasm_type(wasm_exec_env_t exec_env, void *ctx,          \
                                 void *obj, elem_type fill_value,              \
                                 void *start_obj, void *end_obj)               \
    {                                                                          \
        uint32_t len;                                                          \
        int iter, end;                                                         \
        double f_iter, f_end;                                                  \
        dyn_value_t start_idx, end_idx;                                        \
        dyn_ctx_t dyn_ctx = dyntype_get_context();                             \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                         \
        wasm_value_t value = { 0 };                                            \
        len = get_array_length(obj);                                           \
        if (len == 0) {                                                        \
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), \
                                       "array is empty");                      \
            return 0;                                                          \
        }                                                                      \
        value.wasm_field = fill_value;                                         \
        start_idx = (dyn_value_t)wasm_anyref_obj_get_value(start_obj);         \
        end_idx = (dyn_value_t)wasm_anyref_obj_get_value(end_obj);             \
        dyntype_to_number(dyn_ctx, start_idx, &f_iter);                        \
        iter = (int32)f_iter;                                                  \
        dyntype_to_number(dyn_ctx, end_idx, &f_end);                           \
        end = (int32)f_end;                                                    \
        iter = iter < 0 ? 0 : iter;                                            \
        end = end > len ? len : end;                                           \
        for (; iter != end; iter++) {                                          \
            wasm_array_obj_set_elem(arr_ref, iter, &value);                    \
        }                                                                      \
        return obj;                                                            \
    }

ARRAY_FILL_API(double, f64, f64)
ARRAY_FILL_API(float, f32, f32)
ARRAY_FILL_API(uint64, i64, i64)
ARRAY_FILL_API(uint32, i32, i32)
ARRAY_FILL_API(void *, anyref, gc_obj)

/* Ensure the value of idx keeps between 0~len-1
 *  return -1 if idx >= len
 */
int
compute_index(double idx, uint32_t _len)
{
    int32 res;
    int32 len = _len;

    if (-idx <= len && idx < 0) {
        res = idx + len;
    }
    else if (-idx > len) {
        res = 0;
    }
    else if (idx >= len) {
        res = -1;
    }
    else {
        res = idx;
    }
    return res;
}

void *
array_copyWithin_generic(wasm_exec_env_t exec_env, void *ctx, void *obj,
                         double target, double start, void *end_obj)
{
    int target_idx, start_idx, end_idx, copy_count;
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    uint32_t len = get_array_length(obj);
    double end_idx_double = len;
    dyn_value_t const end_value =
        (dyn_value_t)wasm_anyref_obj_get_value(end_obj);

    /* Ensure that the value of target_idx keeps between 0~len-1*/
    target_idx = compute_index(target, len);
    if (-1 == target_idx) {
        return obj;
    }
    /* Ensure that the value of start_idx keeps between 0~len-1*/
    start_idx = compute_index(start, len);
    if (-1 == start_idx) {
        return obj;
    }

    /* If end is given, ensure that the value of end_idx keeps between 0~len*/
    if (dyntype_is_number(dyntype_get_context(), end_value)) {
        dyntype_to_number(dyntype_get_context(), end_value, &end_idx_double);
    }
    else if (dyntype_is_undefined(dyntype_get_context(), end_value)) {
        end_idx_double = 0;
    }

    end_idx = compute_index(end_idx_double, len);
    if (-1 == end_idx) {
        end_idx = len;
    }
    /* Compute copy count */
    copy_count = end_idx - start_idx;
    if (copy_count <= 0) {
        return obj;
    }
    copy_count = start_idx + copy_count > len ? len - start_idx : copy_count;
    copy_count = target_idx + copy_count > len ? len - target_idx : copy_count;

    /* Copy elements */
    wasm_array_obj_copy(arr_ref, target_idx, arr_ref, start_idx, copy_count);
    return obj;
}

#define ARRAY_INCLUDES_API(elem_type, wasm_type, wasm_field)                   \
    bool array_includes_##wasm_type(wasm_exec_env_t exec_env, void *ctx,       \
                                    void *obj, elem_type search_elem,          \
                                    void *from_obj)                            \
    {                                                                          \
        uint32_t len = get_array_length(obj);                                  \
        elem_type element_value;                                               \
        wasm_array_obj_t arr_ref = get_array_ref(obj);                         \
        wasm_value_t value = { 0 };                                            \
        double from_idx_double;                                                \
        int from_idx = 0;                                                      \
        dyn_value_t const from_idx_value =                                     \
            (dyn_value_t)wasm_anyref_obj_get_value(from_obj);                  \
                                                                               \
        if (dyntype_is_number(dyntype_get_context(), from_idx_value)) {        \
            dyntype_to_number(dyntype_get_context(), from_idx_value,           \
                              &from_idx_double);                               \
            from_idx = from_idx_double;                                        \
        }                                                                      \
        else if (dyntype_is_undefined(dyntype_get_context(),                   \
                                      from_idx_value)) {                       \
            from_idx = 0;                                                      \
        }                                                                      \
                                                                               \
        if (from_idx < 0) {                                                    \
            from_idx = -from_idx > len ? 0 : from_idx + len;                   \
        }                                                                      \
                                                                               \
        if (len == 0 || from_idx >= len) {                                     \
            return false;                                                      \
        }                                                                      \
                                                                               \
        for (int i = from_idx; i < len; ++i) {                                 \
            wasm_array_obj_get_elem(arr_ref, i, false, &value);                \
            element_value = value.wasm_field;                                  \
            /* If the element type is string, use strcmp to judge if the array \
             * contains search_elem */                                         \
            if (element_value == search_elem) {                                \
                return true;                                                   \
            }                                                                  \
        }                                                                      \
        return false;                                                          \
    }

static bool
includes_string(wasm_value_t cur_value, void *search_elem)
{
#if WASM_ENABLE_STRINGREF != 0
    return string_compare((wasm_stringref_obj_t)cur_value.gc_obj, search_elem);
#else
    wasm_value_t field1 = { 0 };
    wasm_value_t target_string = { 0 };
    uint32_t string_len, target_string_len;

    wasm_struct_obj_get_field((wasm_struct_obj_t)cur_value.gc_obj, 1, false,
                              &field1);
    wasm_struct_obj_get_field(search_elem, 1, false, &target_string);
    string_len = wasm_array_obj_length((wasm_array_obj_t)field1.gc_obj);
    target_string_len =
        wasm_array_obj_length((wasm_array_obj_t)target_string.gc_obj);

    if (string_len != target_string_len) {
        return false;
    }

    void *str = wasm_array_obj_elem_addr((wasm_array_obj_t)field1.gc_obj, 0);
    void *str_target =
        wasm_array_obj_elem_addr((wasm_array_obj_t)target_string.gc_obj, 0);

    if (memcmp(str, str_target, string_len) == 0) {
        return true;
    }
    return false;
#endif
}

bool
array_includes_anyref(wasm_exec_env_t exec_env, void *ctx, void *obj,
                      void *search_elem, void *from_obj)
{
    int from_idx = 0;
    double from_idx_double;
    bool elem_is_string;
    wasm_value_t value = { 0 };
    uint32_t len = get_array_length(obj);
    wasm_array_obj_t arr_ref = get_array_ref(obj);
    dyn_value_t const from_idx_value =
        (dyn_value_t)wasm_anyref_obj_get_value(from_obj);
#if WASM_ENABLE_STRINGREF == 0
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
#endif

    if (dyntype_is_number(dyntype_get_context(), from_idx_value)) {
        dyntype_to_number(dyntype_get_context(), from_idx_value,
                          &from_idx_double);
        from_idx = from_idx_double;
    }
    else if (dyntype_is_undefined(dyntype_get_context(), from_idx_value)) {
        from_idx = 0;
    }
    if (from_idx < 0) {
        from_idx = -from_idx > len ? 0 : from_idx + len;
    }

    if (len == 0 || from_idx >= len) {
        return false;
    }

    wasm_array_obj_get_elem(arr_ref, from_idx, false, &value);
#if WASM_ENABLE_STRINGREF != 0
    elem_is_string = wasm_obj_is_stringref_obj(value.gc_obj);
#else
    elem_is_string =
        is_ts_string_type(module, wasm_obj_get_defined_type(value.gc_obj));
#endif

    for (int i = from_idx; i < len; ++i) {
        wasm_array_obj_get_elem(arr_ref, i, 0, &value);
        if (elem_is_string && includes_string(value, search_elem)) {
            return true;
        }
        else {
            /* compare by address */
            if (value.gc_obj == search_elem) {
                return true;
            }
        }
    }
    return false;
}

ARRAY_INCLUDES_API(double, f64, f64)
ARRAY_INCLUDES_API(float, f32, f32)
ARRAY_INCLUDES_API(uint64, i64, i64)
ARRAY_INCLUDES_API(uint32, i32, i32)

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name, signature, NULL }

static NativeSymbol native_symbols[] = {
    REG_NATIVE_FUNC(array_push_generic, "(rrr)F"),
    REG_NATIVE_FUNC(array_pop_f64, "(rr)F"),
    REG_NATIVE_FUNC(array_pop_f32, "(rr)f"),
    REG_NATIVE_FUNC(array_pop_i64, "(rr)I"),
    REG_NATIVE_FUNC(array_pop_i32, "(rr)i"),
    REG_NATIVE_FUNC(array_pop_anyref, "(rr)r"),
    REG_NATIVE_FUNC(array_join_f64, "(rrr)r"),
    REG_NATIVE_FUNC(array_join_f32, "(rrr)r"),
    REG_NATIVE_FUNC(array_join_i64, "(rrr)r"),
    REG_NATIVE_FUNC(array_join_i32, "(rrr)r"),
    REG_NATIVE_FUNC(array_join_anyref, "(rrr)r"),
    REG_NATIVE_FUNC(array_concat_generic, "(rrr)r"),
    REG_NATIVE_FUNC(array_reverse_generic, "(rr)r"),
    REG_NATIVE_FUNC(array_shift_f64, "(rr)F"),
    REG_NATIVE_FUNC(array_shift_f32, "(rr)f"),
    REG_NATIVE_FUNC(array_shift_i64, "(rr)I"),
    REG_NATIVE_FUNC(array_shift_i32, "(rr)i"),
    REG_NATIVE_FUNC(array_shift_anyref, "(rr)r"),
    REG_NATIVE_FUNC(array_slice_generic, "(rrrr)r"),
    REG_NATIVE_FUNC(array_sort_generic, "(rrr)r"),
    REG_NATIVE_FUNC(array_splice_generic, "(rrFrr)r"),
    REG_NATIVE_FUNC(array_unshift_generic, "(rrr)F"),
    REG_NATIVE_FUNC(array_indexOf_f64, "(rrFr)F"),
    REG_NATIVE_FUNC(array_indexOf_f32, "(rrfr)F"),
    REG_NATIVE_FUNC(array_indexOf_i64, "(rrIr)F"),
    REG_NATIVE_FUNC(array_indexOf_i32, "(rrir)F"),
    REG_NATIVE_FUNC(array_indexOf_anyref, "(rrrr)F"),
    REG_NATIVE_FUNC(array_lastIndexOf_f64, "(rrFr)F"),
    REG_NATIVE_FUNC(array_lastIndexOf_f32, "(rrfr)F"),
    REG_NATIVE_FUNC(array_lastIndexOf_i64, "(rrIr)F"),
    REG_NATIVE_FUNC(array_lastIndexOf_i32, "(rrir)F"),
    REG_NATIVE_FUNC(array_lastIndexOf_anyref, "(rrrr)F"),
    REG_NATIVE_FUNC(array_every_generic, "(rrr)i"),
    REG_NATIVE_FUNC(array_some_generic, "(rrr)i"),
    REG_NATIVE_FUNC(array_forEach_generic, "(rrr)"),
    REG_NATIVE_FUNC(array_map_generic, "(rrr)r"),
    REG_NATIVE_FUNC(array_filter_generic, "(rrr)r"),
    REG_NATIVE_FUNC(array_reduce_f64, "(rrrF)F"),
    REG_NATIVE_FUNC(array_reduce_f32, "(rrrf)f"),
    REG_NATIVE_FUNC(array_reduce_i64, "(rrrI)I"),
    REG_NATIVE_FUNC(array_reduce_i32, "(rrri)i"),
    REG_NATIVE_FUNC(array_reduce_anyref, "(rrrr)r"),
    REG_NATIVE_FUNC(array_reduceRight_f64, "(rrrF)F"),
    REG_NATIVE_FUNC(array_reduceRight_f32, "(rrrf)f"),
    REG_NATIVE_FUNC(array_reduceRight_i64, "(rrrI)I"),
    REG_NATIVE_FUNC(array_reduceRight_i32, "(rrri)i"),
    REG_NATIVE_FUNC(array_reduceRight_anyref, "(rrrr)r"),
    REG_NATIVE_FUNC(array_find_generic, "(rrr)r"),
    REG_NATIVE_FUNC(array_findIndex_generic, "(rrr)F"),
    REG_NATIVE_FUNC(array_fill_f64, "(rrFrr)r"),
    REG_NATIVE_FUNC(array_fill_f32, "(rrfrr)r"),
    REG_NATIVE_FUNC(array_fill_i64, "(rrIrr)r"),
    REG_NATIVE_FUNC(array_fill_i32, "(rrirr)r"),
    REG_NATIVE_FUNC(array_fill_anyref, "(rrrrr)r"),
    REG_NATIVE_FUNC(array_copyWithin_generic, "(rrFFr)r"),
    REG_NATIVE_FUNC(array_includes_f64, "(rrFr)i"),
    REG_NATIVE_FUNC(array_includes_f32, "(rrfr)i"),
    REG_NATIVE_FUNC(array_includes_i64, "(rrIr)i"),
    REG_NATIVE_FUNC(array_includes_i32, "(rrir)i"),
    REG_NATIVE_FUNC(array_includes_anyref, "(rrrr)i"),
};
/* clang-format on */

uint32_t
get_lib_array_symbols(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "env";
    *p_native_symbols = native_symbols;
    return sizeof(native_symbols) / sizeof(NativeSymbol);
}
