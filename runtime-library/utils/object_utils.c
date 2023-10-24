/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#if WASM_ENABLE_STRINGREF != 0
#include "string_object.h"
#endif

#include "gc_object.h"
#include "libdyntype.h"
#include "object_utils.h"
#include "type_utils.h"
#include "wamr_utils.h"
#include "libdyntype_export.h"
#include "dynamic/pure_dynamic.h"
#include "lib_struct_indirect.h"

void
dynamic_object_finalizer(wasm_anyref_obj_t obj, void *data)
{
    dyn_value_t value = (dyn_value_t)wasm_anyref_obj_get_value(obj);
    dyntype_release((dyn_ctx_t)data, value);
}

wasm_anyref_obj_t
box_ptr_to_anyref(wasm_exec_env_t exec_env, dyn_ctx_t ctx, void *ptr)
{
    wasm_anyref_obj_t any_obj =
        (wasm_anyref_obj_t)wasm_anyref_obj_new(exec_env, ptr);
    if (!any_obj) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "alloc memory failed");
        return NULL;
    }
    wasm_obj_set_gc_finalizer(exec_env, (wasm_obj_t)any_obj,
                              (wasm_obj_finalizer_t)dynamic_object_finalizer,
                              ctx);
    return any_obj;
}

static uint32
get_slot_count(wasm_ref_type_t type)
{
    if (type.value_type == VALUE_TYPE_I32) {
        return sizeof(uint32) / sizeof(uint32);
    }
    else if (type.value_type == VALUE_TYPE_F64) {
        return sizeof(double) / sizeof(uint32);
    }
    else {
        return sizeof(void *) / sizeof(uint32);
    }
}

dyn_value_t
box_value_to_any(wasm_exec_env_t exec_env, dyn_ctx_t ctx, wasm_value_t *value,
                 wasm_ref_type_t type, bool is_get_property, int index)
{
    dyn_value_t ret = NULL;
    wasm_defined_type_t ret_defined_type = { 0 };
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
    wasm_function_inst_t alloc_extref_table_slot = NULL;

    if (type.value_type == VALUE_TYPE_I32) {
        /* boolean */
        uint32_t ori_value = 0;
        if (is_get_property) {
            ori_value = struct_get_indirect_i32(
                exec_env, (wasm_anyref_obj_t)value->gc_obj, index);
        }
        else {
            ori_value = value->i32;
        }
        ret = dynamic_new_boolean(ctx, (bool)ori_value);
    }
    else if (type.value_type == VALUE_TYPE_F64) {
        /* number */
        double ori_value = 0;
        if (is_get_property) {
            ori_value = struct_get_indirect_f64(
                exec_env, (wasm_anyref_obj_t)value->gc_obj, index);
        }
        else {
            ori_value = value->f64;
        }
        ret = dynamic_new_number(ctx, ori_value);
    }
    else if (type.value_type == REF_TYPE_ANYREF) {
        /* any */
        void *ori_value = NULL;
        if (is_get_property) {
            ori_value = struct_get_indirect_anyref(
                exec_env, (wasm_anyref_obj_t)value->gc_obj, index);
        }
        else {
            ori_value = value->gc_obj;
        }
        ret = dynamic_hold(ctx,
                           (dyn_value_t)wasm_anyref_obj_get_value(ori_value));
    }
#if WASM_ENABLE_STRINGREF != 0
    else if (type.value_type == REF_TYPE_STRINGREF) {
        /* stringref */
        wasm_stringref_obj_t ori_value = NULL;
        if (is_get_property) {
            ori_value = (wasm_stringref_obj_t)struct_get_indirect_anyref(
                exec_env, (wasm_anyref_obj_t)value->gc_obj, index);
        }
        else {
            ori_value = (wasm_stringref_obj_t)value->gc_obj;
        }

        ret = dyntype_new_string(
            ctx, (void *)wasm_stringref_obj_get_value(ori_value));
    }
#endif
    else {
        void *ori_value = NULL;
        wasm_struct_type_t new_closure_type = NULL;
        ret_defined_type = wasm_get_defined_type(module, type.heap_type);
        wasm_value_t tmp_func = { 0 };
        if (is_get_property) {
            /* if property is a method, then we can only get funcref, need to
             * wrap to closure manually */
            if (wasm_defined_type_is_func_type(ret_defined_type)) {
                void *vtable = struct_get_indirect_anyref(
                    exec_env, (wasm_anyref_obj_t)value->gc_obj, 0);
                void *func_ref = struct_get_indirect_funcref(
                    exec_env, (wasm_anyref_obj_t)vtable, index);
                get_closure_struct_type(module, &new_closure_type);
                ret_defined_type = (wasm_defined_type_t)new_closure_type;
                ori_value =
                    wasm_struct_obj_new_with_type(exec_env, new_closure_type);
                tmp_func.gc_obj = (wasm_obj_t)func_ref;
                wasm_struct_obj_set_field(ori_value, 1, &tmp_func);
            }
            else {
                ori_value = struct_get_indirect_anyref(
                    exec_env, (wasm_anyref_obj_t)value->gc_obj, index);
            }
        }
        else {
            bh_memcpy_s(&ori_value, sizeof(void *), value, sizeof(void *));
        }

        if (wasm_defined_type_is_struct_type(ret_defined_type)) {
#if WASM_ENABLE_STRINGREF == 0
            if (is_ts_string_type(module, ret_defined_type)) {
                const char *str = get_str_from_string_struct(ori_value);
                uint32_t str_len = get_str_length_from_string_struct(ori_value);

                ret = dynamic_new_string(ctx, str, str_len);
            }
            else {
#endif
                wasm_value_t wasm_ret_value = { 0 };
                uint32_t occupied_slots = 0;
                uint32_t extref_argv[6] = { 0 };
                uint32_t extref_agc = 6;
                int tag = 0;

                if (is_ts_array_type(module, ret_defined_type)) {
                    tag = ExtArray;
                }
                else if (is_ts_closure_type(module, ret_defined_type)) {
                    tag = ExtFunc;
                }
                else {
                    tag = ExtObj;
                }

                alloc_extref_table_slot = wasm_runtime_lookup_function(
                    module_inst, "allocExtRefTableSlot", "(r)i");
                bh_assert(alloc_extref_table_slot);

                bh_memcpy_s(extref_argv + occupied_slots,
                            sizeof(wasm_anyref_obj_t), &ori_value,
                            sizeof(wasm_anyref_obj_t));
                occupied_slots += sizeof(wasm_anyref_obj_t) / sizeof(uint32);
                extref_agc = occupied_slots;

                if (!wasm_runtime_call_wasm(exec_env, alloc_extref_table_slot,
                                            extref_agc, extref_argv)) {
                    return NULL;
                }
                bh_memcpy_s(&wasm_ret_value, sizeof(wasm_anyref_obj_t),
                            extref_argv, sizeof(wasm_anyref_obj_t));
                ret = dyntype_new_extref(
                    ctx, (void *)(uintptr_t)wasm_ret_value.i32, tag, NULL);
#if WASM_ENABLE_STRINGREF == 0
            }
#endif
        }
    }

    return ret;
}

#if WASM_ENABLE_STRINGREF != 0
bool
string_compare(wasm_stringref_obj_t lhs, wasm_stringref_obj_t rhs)
{
    return wasm_string_eq((WASMString)wasm_stringref_obj_get_value(lhs),
                          (WASMString)wasm_stringref_obj_get_value(rhs));
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

#if WASM_ENABLE_STRINGREF != 0
wasm_stringref_obj_t
#else
wasm_struct_obj_t
#endif
unbox_string_from_any(wasm_exec_env_t exec_env, dyn_ctx_t ctx, dyn_value_t obj)
{
    char *value = NULL;
    int ret;
    void *new_string_struct = NULL;

    ret = dynamic_to_cstring(ctx, obj, &value);
    if (ret != DYNTYPE_SUCCESS) {
        goto end;
    }

    new_string_struct = create_wasm_string(exec_env, value);
    if (!new_string_struct) {
        goto end;
    }

end:
    if (value) {
        dyntype_free_cstring(UNBOX_ANYREF(ctx), value);
    }

    return new_string_struct;
}

void
unbox_value_from_any(wasm_exec_env_t exec_env, dyn_ctx_t ctx, dyn_value_t obj,
                     wasm_ref_type_t type, wasm_value_t *unboxed_value,
                     bool is_set_property, int index)
{
    wasm_defined_type_t ret_defined_type = { 0 };
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);

    if (type.value_type == VALUE_TYPE_I32) {
        bool ret_value;
        if (dynamic_to_bool(ctx, obj, &ret_value) != DYNTYPE_SUCCESS) {
            goto fail;
        }
        if (is_set_property) {
            struct_set_indirect_i32(exec_env,
                                    (wasm_anyref_obj_t)unboxed_value->gc_obj,
                                    index, ret_value);
        }
        else {
            unboxed_value->i32 = ret_value;
        }
    }
    else if (type.value_type == VALUE_TYPE_F64) {
        double ret_value;
        if (dyntype_to_number(ctx, obj, &ret_value) != DYNTYPE_SUCCESS) {
            goto fail;
        }
        if (is_set_property) {
            struct_set_indirect_f64(exec_env,
                                    (wasm_anyref_obj_t)unboxed_value->gc_obj,
                                    index, ret_value);
        }
        else {
            unboxed_value->f64 = ret_value;
        }
    }
    else if (type.value_type == REF_TYPE_ANYREF) {
        void *ret_value =
            box_ptr_to_anyref(exec_env, ctx, dyntype_hold(ctx, obj));
        if (is_set_property) {
            struct_set_indirect_anyref(exec_env,
                                       (wasm_anyref_obj_t)unboxed_value->gc_obj,
                                       index, ret_value);
        }
        else {
            unboxed_value->gc_obj = ret_value;
        }
    }
#if WASM_ENABLE_STRINGREF != 0
    else if (type.value_type == REF_TYPE_STRINGREF) {
        /* stringref */
        void *str_obj = dyntype_to_string(ctx, (obj));
        wasm_stringref_obj_t ret_value =
            wasm_stringref_obj_new(exec_env, str_obj);
        if (is_set_property) {
            struct_set_indirect_anyref(exec_env,
                                       (wasm_anyref_obj_t)unboxed_value->gc_obj,
                                       index, ret_value);
        }
        else {
            unboxed_value->gc_obj = (wasm_obj_t)ret_value;
        }
    }
#endif
    else {
        ret_defined_type = wasm_get_defined_type(module, type.heap_type);
        if (wasm_defined_type_is_struct_type(ret_defined_type)) {
#if WASM_ENABLE_STRINGREF == 0
            if (is_ts_string_type(module, ret_defined_type)) {
                void *ret_value = unbox_string_from_any(exec_env, ctx, obj);
                if (is_set_property) {
                    struct_set_indirect_anyref(
                        exec_env, (wasm_anyref_obj_t)unboxed_value->gc_obj,
                        index, ret_value);
                }
                else {
                    unboxed_value->gc_obj = ret_value;
                }
            }
            else {
#endif
                void *ret_value;
                uint32_t table_idx;
                void *p_table_index;
                int32_t tag = dynamic_to_extref(ctx, obj, &p_table_index);

                if (tag == -DYNTYPE_TYPEERR) {
                    goto fail;
                }
                table_idx = (uint32_t)(uintptr_t)p_table_index;

                ret_value = wamr_utils_get_table_element(exec_env, table_idx);
                if (is_set_property) {
                    struct_set_indirect_anyref(
                        exec_env, (wasm_anyref_obj_t)unboxed_value->gc_obj,
                        index, ret_value);
                }
                else {
                    unboxed_value->gc_obj = ret_value;
                }
#if WASM_ENABLE_STRINGREF == 0
            }
#endif
        }
    }

    return;

fail:
    wasm_runtime_set_exception(module_inst, "failed to unbox value from any");
}

dyn_value_t
call_wasm_func_with_boxing(wasm_exec_env_t exec_env, dyn_ctx_t ctx,
                           wasm_anyref_obj_t func_any_obj, uint32_t argc,
                           dyn_value_t *func_args)
{
    int i;
    dyn_value_t ret = NULL;
    wasm_value_t context = { 0 };
    wasm_value_t func_ref = { 0 };
    wasm_func_obj_t func_obj = { 0 };
    wasm_func_type_t func_type = { 0 };
    wasm_ref_type_t result_type = { 0 };
    wasm_ref_type_t tmp_param_type = { 0 };
    wasm_struct_obj_t closure_obj = { 0 };
    wasm_value_t tmp_result;
    wasm_value_t tmp_param;
    wasm_local_obj_ref_t *local_refs = NULL;
    uint32_t slot_count = 0, local_ref_count = 0;
    uint32_t occupied_slots = 0;
    uint32_t *argv = NULL;
    uint32_t bsize = 0;
    uint32_t result_count = 0;
    uint32_t param_count = 0;
    bool is_success;

    closure_obj = (wasm_struct_obj_t)func_any_obj;
    wasm_struct_obj_get_field(closure_obj, 0, false, &context);
    wasm_struct_obj_get_field(closure_obj, 1, false, &func_ref);
    func_obj = (wasm_func_obj_t)(func_ref.gc_obj);
    func_type = wasm_func_obj_get_func_type(func_obj);
    result_count = wasm_func_type_get_result_count(func_type);
    param_count = wasm_func_type_get_param_count(func_type);

    if (param_count != argc + 1) {
        const char *exception =
            "libdyntype: function param count not equal with the real param";
#if WASM_ENABLE_STRINGREF != 0
        return dyntype_throw_exception(
            ctx, dyntype_new_string(
                     ctx, wasm_stringref_obj_get_value(
                              create_wasm_string(exec_env, exception))));
#else
        return dyntype_throw_exception(
            ctx, dyntype_new_string(ctx, exception, strlen(exception)));
#endif
    }

    bsize = sizeof(uint64) * (param_count);
    argv = wasm_runtime_malloc(bsize);
    if (!argv) {
        const char *exception = "libdyntype: alloc memory failed";
#if WASM_ENABLE_STRINGREF != 0
        return dyntype_throw_exception(
            ctx, dyntype_new_string(
                     ctx, wasm_stringref_obj_get_value(
                              create_wasm_string(exec_env, exception))));
#else
        return dyntype_throw_exception(
            ctx, dyntype_new_string(ctx, exception, strlen(exception)));
#endif
    }

    /* reserve space for the biggest slots */
    bh_memcpy_s(argv, bsize - occupied_slots, &(context.gc_obj),
                sizeof(wasm_anyref_obj_t));
    occupied_slots += sizeof(wasm_anyref_obj_t) / sizeof(uint32);

    if (argc > 0
        && !(local_refs =
                 wasm_runtime_malloc(sizeof(wasm_local_obj_ref_t) * argc))) {
        const char *exception = "libdyntype: alloc memory failed";
#if WASM_ENABLE_STRINGREF != 0
        ret = dyntype_throw_exception(
            ctx, dyntype_new_string(
                     ctx, wasm_stringref_obj_get_value(
                              create_wasm_string(exec_env, exception))));
#else
        ret = dyntype_throw_exception(
            ctx, dyntype_new_string(ctx, exception, strlen(exception)));
#endif
        goto end;
    }

    for (i = 0; i < argc; i++) {
        tmp_param_type = wasm_func_type_get_param_type(func_type, i + 1);
        slot_count = get_slot_count(tmp_param_type);
        unbox_value_from_any(exec_env, ctx, func_args[i], tmp_param_type,
                             &tmp_param, false, -1);

        if (tmp_param_type.value_type == VALUE_TYPE_ANYREF
#if WASM_ENABLE_STRINGREF != 0
            || tmp_param_type.value_type == VALUE_TYPE_STRINGREF
#endif
        ) {
            /* unbox_value_from_any will create anyref for any-objects, we must
             * hold its reference to avoid it being claimed */
            wasm_runtime_push_local_object_ref(exec_env,
                                               &local_refs[local_ref_count]);
            local_refs[local_ref_count++].val = tmp_param.gc_obj;
        }

        bh_memcpy_s(argv + occupied_slots,
                    bsize - occupied_slots * sizeof(uint32), &tmp_param,
                    slot_count * sizeof(uint32));
        occupied_slots += slot_count;
    }

    if (local_ref_count) {
        wasm_runtime_pop_local_object_refs(exec_env, local_ref_count);
    }

    is_success =
        wasm_runtime_call_func_ref(exec_env, func_obj, occupied_slots, argv);
    if (!is_success) {
        /* static throw or dynamic throw can not be defined in compilation
         */
        /* workaround: exception-handling proposal is not implemented in
         * WAMR yet, so where to get the thrown exception in unkown, just
         * pass undefined as exception */
        ret = dyntype_throw_exception(ctx, dyntype_new_undefined(ctx));
        goto end;
    }

    if (result_count > 0) {
        result_type = wasm_func_type_get_result_type(func_type, 0);
        slot_count = get_slot_count(result_type);
        bh_memcpy_s(&tmp_result, slot_count * sizeof(uint32), argv,
                    slot_count * sizeof(uint32));
        ret = box_value_to_any(exec_env, ctx, &tmp_result, result_type, false,
                               -1);
    }
    else {
        ret = dynamic_new_undefined(ctx);
    }

end:
    if (local_refs) {
        wasm_runtime_free(local_refs);
    }

    wasm_runtime_free(argv);

    return ret;
}
