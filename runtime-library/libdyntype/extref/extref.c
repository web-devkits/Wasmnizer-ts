/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "extref.h"
#include "dynamic/pure_dynamic.h"
#include "libdyntype_export.h"
#include "bh_assert.h"
#include "bh_common.h"
#include "gc_export.h"
#include "wamr_utils.h"
#include "type_utils.h"
#include "object_utils.h"

#define EXTREF_PROLOGUE()                                                    \
    int ext_tag;                                                             \
    void *p_table_index;                                                     \
    uint32_t table_index;                                                    \
    wasm_exec_env_t exec_env = dyntype_context_get_exec_env();               \
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env); \
                                                                             \
    bh_assert(exec_env);                                                     \
                                                                             \
    ext_tag = dynamic_to_extref(ctx, obj, &p_table_index);                   \
    table_index = (uint32_t)(uintptr_t)p_table_index;

int
extref_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtArray) {
        /* Get static array info */
        WasmArrayInfo arr_info;
        wasm_value_t unboxed_elem_value = { 0 };

        get_static_array_info(exec_env, table_index, &arr_info);

        /* unbox value from any */
        unbox_value_from_any(exec_env, ctx, elem, arr_info.element_type,
                             &unboxed_elem_value, false, -1);

        /* set value to array */
        wasm_array_obj_set_elem(arr_info.ref, index, &unboxed_elem_value);
        return DYNTYPE_SUCCESS;
    }
    else {
        wasm_runtime_set_exception(module_inst,
                                   "libdyntype: set element on non-array object");
        return -DYNTYPE_TYPEERR;
    }
}

dyn_value_t
extref_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtArray) {
        /* Get static array info */
        WasmArrayInfo arr_info;
        wasm_value_t elem_value = { 0 };
        dyn_value_t elem_res_any = NULL;

        get_static_array_info(exec_env, table_index, &arr_info);

        /* get value from array */
        wasm_array_obj_get_elem(arr_info.ref, index, false, &elem_value);

        /* unbox value from any */
        elem_res_any = box_value_to_any(
            exec_env, ctx, &elem_value, arr_info.element_type, false, -1);
        return elem_res_any;
    }
    else {
        wasm_runtime_set_exception(module_inst,
                                   "libdyntype: get element on non-array object");
        return NULL;
    }
}

int
extref_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtObj) {
        int index;
        wasm_ref_type_t field_type;
        wasm_obj_t wasm_obj =
            (wasm_obj_t)wamr_utils_get_table_element(exec_env, table_index);
        wasm_value_t wasm_value = { .gc_obj = wasm_obj };

        bh_assert(wasm_obj_is_struct_obj(wasm_obj));
        index =
            get_prop_index_of_struct(exec_env, prop, &wasm_obj, &field_type);

        if (index < 0) {
            return dynamic_set_property(ctx, obj, prop, value);
        }
        else {
            unbox_value_from_any(exec_env, ctx, value, field_type, &wasm_value,
                                 true, index);
            return DYNTYPE_SUCCESS;
        }
    }
    else if (ext_tag == ExtArray) {
        wasm_runtime_set_exception(module_inst,
                                    "libdyntype: set property on non-object");
    }

    return -DYNTYPE_TYPEERR;
}

dyn_value_t
extref_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtObj) {
        int index;
        wasm_ref_type_t field_type;
        wasm_obj_t wasm_obj =
            (wasm_obj_t)wamr_utils_get_table_element(exec_env, table_index);

        bh_assert(wasm_obj_is_struct_obj(wasm_obj));
        index =
            get_prop_index_of_struct(exec_env, prop, &wasm_obj, &field_type);
        if (index < 0) {
            return dynamic_get_property(ctx, obj, prop);
        }
        else {
            wasm_value_t field_wasm_value = { .gc_obj = wasm_obj };
            return box_value_to_any(exec_env, ctx, &field_wasm_value,
                                    field_type, true, index);
        }
    }
    else if (ext_tag == ExtArray) {
        WasmArrayInfo arr_info;
        if (strcmp(prop, "length") != 0) {
            wasm_runtime_set_exception(module_inst,
                                       "libdyntype: get property on non-object");
            return NULL;
        }

        get_static_array_info(exec_env, table_index, &arr_info);
        return dynamic_new_number(ctx, (double)arr_info.lengh);
    }

    return NULL;
}

dyn_value_t
extref_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    return extref_get_property(ctx, obj, prop);
}

int
extref_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtObj) {
        int index;
        wasm_ref_type_t field_type;
        wasm_obj_t wasm_obj =
            (wasm_obj_t)wamr_utils_get_table_element(exec_env, table_index);

        bh_assert(wasm_obj_is_struct_obj(wasm_obj));
        index =
            get_prop_index_of_struct(exec_env, prop, &wasm_obj, &field_type);

        if (index < 0) {
            return dynamic_has_property(ctx, obj, prop);
        }
        else {
            return DYNTYPE_TRUE;
        }
    }
    else {
        wasm_runtime_set_exception(module_inst,
                                    "libdyntype: check property on non-object");
    }

    return DYNTYPE_FALSE;
}

int
extref_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    EXTREF_PROLOGUE()

    if (ext_tag == ExtObj) {
        int index;
        wasm_ref_type_t field_type;
        wasm_obj_t wasm_obj =
            (wasm_obj_t)wamr_utils_get_table_element(exec_env, table_index);

        bh_assert(wasm_obj_is_struct_obj(wasm_obj));
        index =
            get_prop_index_of_struct(exec_env, prop, &wasm_obj, &field_type);

        if (index < 0) {
            return dynamic_delete_property(ctx, obj, prop);
        }

        wasm_runtime_set_exception(module_inst,
                                   "libdyntype: delete property on static type object");
    }
    else {
        wasm_runtime_set_exception(module_inst,
                                   "libdyntype: delete property on non-object");
    }

    return DYNTYPE_FALSE;
}

dyn_value_t
extref_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
              dyn_value_t *args)
{
    dyn_value_t field_any_obj = NULL;
    dyn_value_t *new_args = NULL;
    dyn_value_t res = NULL;
    EXTREF_PROLOGUE()

    if (ext_tag == ExtObj) {
        /* invoke method of static typed object */
        bh_assert(name);

        field_any_obj = dyntype_get_property(ctx, obj, name);
        /* the method property has been boxed to newExtref, need to unbox to
         * get the real ptr */
        bh_assert(dyntype_is_extref(ctx, field_any_obj));
        ext_tag = dynamic_to_extref(ctx, field_any_obj, (void **)&p_table_index);
        table_index = (uint32_t)(uintptr_t)p_table_index;

        /* add this argument to the argv */
        argc += 1;
        new_args = wasm_runtime_malloc(argc * sizeof(dyn_value_t));
        if (!new_args) {
            wasm_runtime_set_exception(module_inst,
                                       "alloc memory failed");
            return res;
        }
        new_args[0] = obj;
        bh_memcpy_s(new_args + 1, argc - 1, args, argc - 1);
        args = new_args;
    }

    if (ext_tag == ExtFunc) {
        /* invoke static closure */
        wasm_obj_t func_obj =
            (wasm_obj_t)wamr_utils_get_table_element(exec_env, table_index);
        bh_assert(wasm_obj_is_struct_obj(func_obj));
        res = call_wasm_func_with_boxing(
            exec_env, ctx, (wasm_anyref_obj_t)func_obj, argc, args);
    }
    else {
        wasm_runtime_set_exception(module_inst,
                                   "libdyntype: invoke on non-function");
    }

    if (new_args) {
        wasm_runtime_free(new_args);
    }

    if (field_any_obj) {
        /* field_any_obj doesn't returned to wasm side, it's not managed by
         * WasmGC, must be released manually */
        dyntype_release(ctx, field_any_obj);
    }

    return res;
}

void
extref_unsupported(const char *reason)
{
    wasm_exec_env_t exec_env = dyntype_context_get_exec_env();
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, reason);
}