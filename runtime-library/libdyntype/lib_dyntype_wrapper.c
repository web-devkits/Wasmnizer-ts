/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "gc_export.h"
#include "libdyntype_export.h"
#include "object_utils.h"
#include "type_utils.h"
#include "wamr_utils.h"

/****************** Context access *****************/
void *
dyntype_get_context_wrapper(wasm_exec_env_t exec_env)
{
    dyn_ctx_t ctx = dyntype_get_context();
    dyntype_context_set_exec_env(exec_env);
    return wasm_anyref_obj_new(exec_env, ctx);
}

/******************* Field access *******************/
wasm_anyref_obj_t
dyntype_new_number_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           double value)
{
    RETURN_BOX_ANYREF(dyntype_new_number(UNBOX_ANYREF(ctx), value),
                      UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_new_boolean_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                            bool value)
{
    RETURN_BOX_ANYREF(dyntype_new_boolean(UNBOX_ANYREF(ctx), value),
                      UNBOX_ANYREF(ctx));
}

#if WASM_ENABLE_STRINGREF != 0
wasm_anyref_obj_t
dyntype_new_string_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           wasm_stringref_obj_t str_obj)
{
    RETURN_BOX_ANYREF(dyntype_new_string(UNBOX_ANYREF(ctx),
                                         wasm_stringref_obj_get_value(str_obj)),
                      UNBOX_ANYREF(ctx));
}
#else
wasm_anyref_obj_t
dyntype_new_string_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           wasm_struct_obj_t str_obj)
{
    WASMValue arr_obj = { 0 };
    uint32_t arr_len = 0;
    const char *str = "";
    wasm_struct_obj_get_field(str_obj, 1, false, &arr_obj);
    arr_len = wasm_array_obj_length((wasm_array_obj_t)arr_obj.gc_obj);

    if (arr_len != 0) {
        str = (char *)wasm_array_obj_first_elem_addr(
            (wasm_array_obj_t)arr_obj.gc_obj);
    }

    RETURN_BOX_ANYREF(
        dyntype_new_string(UNBOX_ANYREF(ctx), str, arr_len),
        UNBOX_ANYREF(ctx));
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

wasm_anyref_obj_t
dyntype_new_undefined_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx)
{
    RETURN_BOX_ANYREF(dyntype_new_undefined(UNBOX_ANYREF(ctx)),
                      UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_new_null_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx)
{
    RETURN_BOX_ANYREF(dyntype_new_null(UNBOX_ANYREF(ctx)), UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_new_object_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx)
{
    RETURN_BOX_ANYREF(dyntype_new_object(UNBOX_ANYREF(ctx)), UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_new_array_wrapper(wasm_exec_env_t exec_env,
                                      wasm_anyref_obj_t ctx, int len)
{
    RETURN_BOX_ANYREF(dyntype_new_array(UNBOX_ANYREF(ctx), len),
                      UNBOX_ANYREF(ctx));
}

void
dyntype_add_elem_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t obj, wasm_anyref_obj_t elem)
{
}

wasm_anyref_obj_t
dyntype_new_extref_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           void *ptr, external_ref_tag tag)
{
    RETURN_BOX_ANYREF(
        dyntype_new_extref(UNBOX_ANYREF(ctx), ptr, tag, (void *)exec_env),
        UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_get_keys_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t obj)
{
    RETURN_BOX_ANYREF(dyntype_get_keys(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj)),
                      UNBOX_ANYREF(ctx));
}

void
dyntype_set_elem_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t obj, int index,
                         wasm_anyref_obj_t elem)
{
    dyntype_set_elem(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), index,
                     UNBOX_ANYREF(elem));
}

dyn_value_t
dyntype_get_elem_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t obj, int index)
{
    RETURN_BOX_ANYREF(
        dyntype_get_elem(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), index),
        UNBOX_ANYREF(ctx));
}

int
dyntype_has_property_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                             wasm_anyref_obj_t obj, const char *prop)
{
    return dyntype_has_property(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), prop);
}

int
dyntype_delete_property_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                                wasm_anyref_obj_t obj, const char *prop)
{
    return dyntype_delete_property(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), prop);
}

int
dyntype_set_property_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                             wasm_anyref_obj_t obj, const char *prop,
                             wasm_anyref_obj_t value)
{
    dyn_value_t dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_value_t dyn_obj = UNBOX_ANYREF(obj);
    dyn_value_t dyn_value = UNBOX_ANYREF(value);

    return dyntype_set_property(dyn_ctx, dyn_obj, prop, dyn_value);
}

dyn_value_t
dyntype_get_property_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                             wasm_anyref_obj_t obj, const char *prop)
{
    dyn_value_t dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_value_t dyn_obj = UNBOX_ANYREF(obj);

    RETURN_BOX_ANYREF(dyntype_get_property(dyn_ctx, dyn_obj, prop), dyn_ctx);
}

wasm_anyref_obj_t
dyntype_get_own_property_wrapper(wasm_exec_env_t exec_env,
                                 wasm_anyref_obj_t ctx, wasm_anyref_obj_t obj,
                                 const char *prop)
{
    RETURN_BOX_ANYREF(
        dyntype_get_own_property(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), prop),
        UNBOX_ANYREF(ctx));
}

int
dyntype_define_property_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                                wasm_anyref_obj_t obj, const char *prop,
                                wasm_anyref_obj_t desc)
{
    return dyntype_define_property(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), prop,
                                   UNBOX_ANYREF(desc));
}

/******************* Runtime type checking *******************/
int
dyntype_is_undefined_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                             wasm_anyref_obj_t obj)
{
    return dyntype_is_undefined(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_is_null_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                        wasm_anyref_obj_t obj)
{
    return dyntype_is_null(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_is_bool_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                        wasm_anyref_obj_t obj)
{
    return dyntype_is_bool(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_to_bool_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                        wasm_anyref_obj_t obj)
{
    bool value = 0, ret;

    ret = dyntype_to_bool(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), &value);
    if (ret != DYNTYPE_SUCCESS) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "libdyntype: failed to convert to bool");
    }

    return value;
}

int
dyntype_is_number_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    return dyntype_is_number(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

double
dyntype_to_number_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    double value = 0;
    bool ret;

    ret = dyntype_to_number(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), &value);
    if (ret != DYNTYPE_SUCCESS) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "libdyntype: failed to convert to number");
    }

    return value;
}

int
dyntype_is_string_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    return dyntype_is_string(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

#if WASM_ENABLE_STRINGREF != 0
wasm_stringref_obj_t
dyntype_to_string_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    return wasm_stringref_obj_new(
        exec_env, dyntype_to_string(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj)));
}
#else
void *
dyntype_to_string_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    char *value = NULL;
    int ret;
    void *new_string_struct = NULL;

    ret = dyntype_to_cstring(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), &value);
    if (ret != DYNTYPE_SUCCESS) {
        if (value) {
            dyntype_free_cstring(UNBOX_ANYREF(ctx), value);
        }
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "libdyntype: failed to convert to cstring");
        return NULL;
    }

    new_string_struct = create_wasm_string(exec_env, value);
    dyntype_free_cstring(UNBOX_ANYREF(ctx), value);

    return (void *)new_string_struct;
}
#endif /* end of WASM_ENABLE_STRINGREF != 0 */

int
dyntype_is_object_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    return dyntype_is_object(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_is_array_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t obj)
{
    return dyntype_is_array(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_is_extref_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    return dyntype_is_extref(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

void *
dyntype_to_extref_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                          wasm_anyref_obj_t obj)
{
    void *value = NULL;
    int ret;

    ret = dyntype_to_extref(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj), &value);
    if (ret < ExtObj || ret > ExtArray) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "libdyntype: failed to convert to extref");
    }

    return value;
}

int
dyntype_is_falsy_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                         wasm_anyref_obj_t value)
{
    return dyntype_is_falsy(UNBOX_ANYREF(ctx), UNBOX_ANYREF(value));
}

void *
dyntype_toString_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
#if WASM_ENABLE_STRINGREF != 0
                         wasm_stringref_obj_t value
#else
                         wasm_anyref_obj_t value
#endif /* end of WASM_ENABLE_STRINGREF != 0 */
)
{
    char *str;
    dyn_type_t type;
    void *res = NULL;
    void *table_elem;
    int32_t table_index;
    dyn_value_t dyn_ctx, dyn_value;
    char *tmp_value = NULL;

    dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_value = UNBOX_ANYREF(value);

    if (dyntype_is_extref(dyn_ctx, dyn_value)) {
        type = dyntype_typeof(dyn_ctx, dyn_value);
        if (type != DynExtRefArray) {
            tmp_value = "[object Object]";
            if (type == DynExtRefFunc) {
                tmp_value = "[wasm Function]";
            }
            res = create_wasm_string(exec_env, tmp_value);
        } else {
            dyntype_to_extref(dyn_ctx, dyn_value, &table_elem);
            table_index = (int32_t)(intptr_t)table_elem;
            table_elem = wamr_utils_get_table_element(exec_env, table_index);
            res = array_to_string(exec_env, dyn_ctx, table_elem, NULL);
        }
    } else {
        dyntype_to_cstring(dyn_ctx, dyn_value, &str);
        if (str == NULL) {
            return NULL;
        }
        res = create_wasm_string(exec_env, str);
        dyntype_free_cstring(dyn_ctx, str);
    }

    return res;
}

/******************* Type equivalence *******************/
/* for typeof keyword*/
void *
dyntype_typeof_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                       wasm_anyref_obj_t obj)
{
    dyn_type_t dyn_type;
    char* value;
    void *res = NULL;

    dyn_type = dyntype_typeof(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
    switch (dyn_type) {
        case DynUndefined:
            value = "undefined";
            break;
        case DynBoolean:
            value = "boolean";
            break;
        case DynNumber:
            value = "number";
            break;
        case DynString:
            value = "string";
            break;
        case DynFunction:
        case DynExtRefFunc:
            value = "function";
            break;
        case DynNull:
        case DynObject:
        case DynExtRefObj:
        case DynExtRefArray:
            value = "object";
            break;
        default:
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                    "libdyntype: typeof getting unknown type");
            value = "unknown";
    }
    res = create_wasm_string(exec_env, value);

    return res;
}

/* for internal use, no need to create a wasm string*/
dyn_type_t
dyntype_typeof1_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                        wasm_anyref_obj_t obj)
{
    return dyntype_typeof(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_type_eq_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                        wasm_anyref_obj_t lhs, wasm_anyref_obj_t rhs)
{
    return dyntype_type_eq(UNBOX_ANYREF(ctx), UNBOX_ANYREF(lhs),
                           UNBOX_ANYREF(rhs));
}

int
dyntype_cmp_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                    wasm_anyref_obj_t lhs, wasm_anyref_obj_t rhs,
                    cmp_operator operator_kind)
{
    int res = 0;
    dyn_type_t type_l, type_r;
    bool l_is_null = false, r_is_null = false;
    void *lhs_ref, *rhs_ref;
    int32_t lhs_idx, rhs_idx;

    type_l = dyntype_typeof(UNBOX_ANYREF(ctx), UNBOX_ANYREF(lhs));
    type_r = dyntype_typeof(UNBOX_ANYREF(ctx), UNBOX_ANYREF(rhs));

    if (type_l == type_r) {
        res = dyntype_cmp(UNBOX_ANYREF(ctx), UNBOX_ANYREF(lhs), UNBOX_ANYREF(rhs),
                        operator_kind);
    }
    if (res) {
        return res;
    }
    if (dyntype_is_null(UNBOX_ANYREF(ctx), UNBOX_ANYREF(lhs))) {
        l_is_null = true;
    }
    if (dyntype_is_null(UNBOX_ANYREF(ctx), UNBOX_ANYREF(rhs))) {
        r_is_null = true;
    }
    // if one of them is undefined, and the other is not undefined
    if (type_l != type_r && (type_l == DynUndefined || type_r == DynUndefined)) {
        if (operator_kind == ExclamationEqualsToken
            || operator_kind == ExclamationEqualsEqualsToken) {
            res = !res;
        }
        return res;
    }
    // iff null
    if ((!l_is_null && (type_l < DynExtRefObj || type_l > DynExtRefArray))
        || (!r_is_null && (type_r < DynExtRefObj || type_r > DynExtRefArray))) {
        if (type_l != type_r && (operator_kind == ExclamationEqualsToken
            || operator_kind == ExclamationEqualsEqualsToken)) {
            res = !res;
        }
        return res;
    }

    if (!l_is_null) {
        dyntype_to_extref(UNBOX_ANYREF(ctx), UNBOX_ANYREF(lhs), &lhs_ref);
        lhs_idx = (int32_t)(intptr_t)lhs_ref;
        lhs_ref = wamr_utils_get_table_element(exec_env, lhs_idx);
    } else {
        lhs_ref = NULL;
    }
    if (!r_is_null) {
        dyntype_to_extref(UNBOX_ANYREF(ctx), UNBOX_ANYREF(rhs), &rhs_ref);
        rhs_idx = (int32_t)(intptr_t)rhs_ref;
        rhs_ref = wamr_utils_get_table_element(exec_env, rhs_idx);
    } else {
        rhs_ref = NULL;
    }
    res = lhs_ref == rhs_ref;

    if (operator_kind == ExclamationEqualsToken || operator_kind == ExclamationEqualsEqualsToken) {
        res = !res;
    }

    return res;
}

/******************* Subtyping *******************/
wasm_anyref_obj_t
dyntype_new_object_with_proto_wrapper(wasm_exec_env_t exec_env,
                                      wasm_anyref_obj_t ctx,
                                      const wasm_anyref_obj_t proto_obj)
{
    RETURN_BOX_ANYREF(dyntype_new_object_with_proto(UNBOX_ANYREF(ctx),
                                                    UNBOX_ANYREF(proto_obj)),
                      UNBOX_ANYREF(ctx));
}

int
dyntype_set_prototype_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                              wasm_anyref_obj_t obj,
                              wasm_anyref_obj_t proto_obj)
{
    return dyntype_set_prototype(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj),
                                 UNBOX_ANYREF(proto_obj));
}

const wasm_anyref_obj_t
dyntype_get_prototype_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                              wasm_anyref_obj_t obj)
{
    RETURN_BOX_ANYREF(
        dyntype_get_prototype(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj)),
        UNBOX_ANYREF(ctx));
}

int
dyntype_instanceof_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           const wasm_anyref_obj_t src_obj,
                           const wasm_anyref_obj_t dst_obj)
{
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_module_t module = wasm_runtime_get_module(module_inst);
    dyn_type_t obj_type;
    dyn_ctx_t dyn_ctx;
    dyn_value_t dyn_src;
    void *table_elem;
    int32_t table_idx;
    wasm_obj_t obj;
    wasm_obj_t inst_obj;
    wasm_defined_type_t inst_type;

    dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_src = UNBOX_ANYREF(src_obj);
    obj_type = dyntype_typeof(dyn_ctx, dyn_src);

    // if src is not an extref object, return false
    if (obj_type < DynExtRefObj) {
        return 0;
    }
    dyntype_to_extref(dyn_ctx, dyn_src, &table_elem);
    table_idx = (int32_t)(intptr_t)table_elem;
    table_elem = wamr_utils_get_table_element(exec_env, table_idx);

    obj = (wasm_obj_t)table_elem;
    inst_obj = (wasm_obj_t)dst_obj;
    if (!wasm_obj_is_struct_obj(inst_obj)) {
        return 0;
    }
    inst_type = wasm_obj_get_defined_type(inst_obj);

    return wasm_obj_is_instance_of_defined_type(obj, inst_type, module);
}

/******************* Dumping *******************/
void
dyntype_dump_value_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           wasm_anyref_obj_t obj)
{
    return dyntype_dump_value(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj));
}

int
dyntype_dump_value_buffer_wrapper(wasm_exec_env_t exec_env,
                                  wasm_anyref_obj_t ctx, wasm_anyref_obj_t obj,
                                  void *buffer, int len)
{
    return dyntype_dump_value_buffer(UNBOX_ANYREF(ctx), UNBOX_ANYREF(obj),
                                     buffer, len);
}

wasm_anyref_obj_t
dyntype_get_global_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                           const char *name)
{
    RETURN_BOX_ANYREF(dyntype_get_global(UNBOX_ANYREF(ctx), name),
                      UNBOX_ANYREF(ctx));
}

wasm_anyref_obj_t
dyntype_new_object_with_class_wrapper(wasm_exec_env_t exec_env,
                                      wasm_anyref_obj_t ctx, const char *name,
                                      wasm_anyref_obj_t args_array)
{
    dyn_value_t ret = NULL;
    dyn_value_t dyn_args = UNBOX_ANYREF(args_array);
    dyn_value_t dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_value_t *argv = NULL;
    int argc = 0;
    int i = 0;

    argc = dyntype_get_array_length(dyn_ctx, dyn_args);
    if (argc < 0) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "array length is less than 0");
        return NULL;
    }
    if (argc) {
        argv = wasm_runtime_malloc(sizeof(dyn_value_t) * argc);
        if (!argv) {
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                       "alloc memory failed");
            return NULL;
        }
    }

    for (i = 0; i < argc; i++) {
        argv[i] = dyntype_get_elem(dyn_ctx, dyn_args, i);
    }

    ret = dyntype_new_object_with_class(dyn_ctx, name, argc, argv);

    if (!ret) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "dyntype_new_object_with_class failed");
        return NULL;
    }
    if (argv) {
        for (i = 0; i < argc; i++) {
            dyntype_release(dyn_ctx, argv[i]);
        }
        wasm_runtime_free(argv);
    }

    RETURN_BOX_ANYREF(ret, dyn_ctx);
}

/******************* Function callback *******************/
wasm_anyref_obj_t
dyntype_invoke_wrapper(wasm_exec_env_t exec_env, wasm_anyref_obj_t ctx,
                       const char *name, wasm_anyref_obj_t obj,
                       wasm_anyref_obj_t args_array)
{
    int i = 0;
    uint32_t argc = 0;
    dyn_value_t dyn_ctx = UNBOX_ANYREF(ctx);
    dyn_value_t dyn_obj = UNBOX_ANYREF(obj);
    dyn_value_t dyn_args = UNBOX_ANYREF(args_array);
    dyn_value_t *func_args = NULL;
    dyn_value_t func_ret = NULL;

    argc = dyntype_get_array_length(dyn_ctx, dyn_args);
    if (argc < 0) {
        wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env),
                                   "array length is less than 0");
        return NULL;
    }
    if (argc > 0) {
        func_args = wasm_runtime_malloc(sizeof(dyn_value_t) * argc);
        if (!func_args) {
            wasm_runtime_set_exception(
                wasm_runtime_get_module_inst(exec_env),
                "alloc memory failed");
            return NULL;
        }
    }

    for (i = 0; i < argc; i++) {
        func_args[i] = dyntype_get_elem(dyn_ctx, dyn_args, i);
    }

    func_ret = dyntype_invoke(dyn_ctx, name, dyn_obj, argc, func_args);

    if (func_args) {
        for (i = 0; i < argc; i++) {
            dyntype_release(dyn_ctx, func_args[i]);
        }
        wasm_runtime_free(func_args);
    }

    RETURN_BOX_ANYREF(func_ret, dyn_ctx);
}

dyn_value_t
dyntype_callback_wasm_dispatcher(void *exec_env_v, dyn_ctx_t ctx, void *vfunc,
                                 dyn_value_t this_obj, int argc,
                                 dyn_value_t *args)
{
    wasm_exec_env_t exec_env = exec_env_v;
    uint32_t func_id = (uint32_t)(uintptr_t)vfunc;
    void *closure = NULL;
    void *res = NULL;

    closure = wamr_utils_get_table_element(exec_env, func_id);
    res = call_wasm_func_with_boxing(exec_env, ctx,
                                     (wasm_anyref_obj_t)closure, argc,
                                     args);

    if (!res) {
        res = dyntype_new_undefined(ctx);
    }

    return res;
}

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name##_wrapper, signature, NULL }

static NativeSymbol native_symbols[] = {
    REG_NATIVE_FUNC(dyntype_get_context, "()r"),

    REG_NATIVE_FUNC(dyntype_new_number, "(rF)r"),
    REG_NATIVE_FUNC(dyntype_new_boolean, "(ri)r"),
    REG_NATIVE_FUNC(dyntype_new_string, "(rr)r"),
    REG_NATIVE_FUNC(dyntype_new_undefined, "(r)r"),
    REG_NATIVE_FUNC(dyntype_new_null, "(r)r"),
    REG_NATIVE_FUNC(dyntype_new_object, "(r)r"),
    REG_NATIVE_FUNC(dyntype_new_array, "(ri)r"),
    REG_NATIVE_FUNC(dyntype_add_elem, "(rrr)"),
    REG_NATIVE_FUNC(dyntype_set_elem, "(rrir)"),
    REG_NATIVE_FUNC(dyntype_get_elem, "(rri)r"),
    REG_NATIVE_FUNC(dyntype_new_extref, "(rii)r"),
    REG_NATIVE_FUNC(dyntype_new_object_with_proto, "(rr)r"),

    REG_NATIVE_FUNC(dyntype_set_prototype, "(rrr)i"),
    REG_NATIVE_FUNC(dyntype_get_prototype, "(rr)r"),

    REG_NATIVE_FUNC(dyntype_get_own_property, "(rr$r)r"),
    REG_NATIVE_FUNC(dyntype_set_property, "(rr$r)i"),
    REG_NATIVE_FUNC(dyntype_define_property, "(rr$r)i"),
    REG_NATIVE_FUNC(dyntype_get_property, "(rr$)r"),
    REG_NATIVE_FUNC(dyntype_has_property, "(rr$)i"),
    REG_NATIVE_FUNC(dyntype_delete_property, "(rr$)i"),

    REG_NATIVE_FUNC(dyntype_get_keys, "(rr)r"),

    REG_NATIVE_FUNC(dyntype_is_undefined, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_null, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_bool, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_number, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_string, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_object, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_array, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_extref, "(rr)i"),

    REG_NATIVE_FUNC(dyntype_to_bool, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_to_number, "(rr)F"),
    REG_NATIVE_FUNC(dyntype_to_string, "(rr)r"),
    REG_NATIVE_FUNC(dyntype_to_extref, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_is_falsy, "(rr)i"),

    REG_NATIVE_FUNC(dyntype_typeof, "(rr)r"),
    REG_NATIVE_FUNC(dyntype_typeof1, "(rr)i"),
    REG_NATIVE_FUNC(dyntype_type_eq, "(rrr)i"),
    REG_NATIVE_FUNC(dyntype_toString, "(rr)r"),
    REG_NATIVE_FUNC(dyntype_cmp, "(rrri)i"),

    REG_NATIVE_FUNC(dyntype_instanceof, "(rrr)i"),

    REG_NATIVE_FUNC(dyntype_new_object_with_class, "(r$r)r"),
    REG_NATIVE_FUNC(dyntype_invoke, "(r$rr)r"),

    REG_NATIVE_FUNC(dyntype_get_global, "(r$)r"),

    /* TODO */
};
/* clang-format on */

uint32_t
get_libdyntype_symbols(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "libdyntype";
    *p_native_symbols = native_symbols;
    return sizeof(native_symbols) / sizeof(NativeSymbol);
}
