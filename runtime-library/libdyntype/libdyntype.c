/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype.h"
#include "dynamic/pure_dynamic.h"
#include "extref/extref.h"

static void *g_exec_env = NULL;
static dyntype_callback_dispatcher_t g_cb_dispatcher = NULL;

/********************************************/
/*     APIs exposed to runtime embedder     */
/********************************************/
dyn_ctx_t
dyntype_context_init()
{
    return dynamic_context_init();
}

dyn_ctx_t
dyntype_context_init_with_opt(dyn_options_t *options)
{
    return dynamic_context_init_with_opt(options);
}

void
dyntype_context_destroy(dyn_ctx_t ctx)
{
    g_exec_env = NULL;
    g_cb_dispatcher = NULL;
    dynamic_context_destroy(ctx);
}

void
dyntype_context_set_exec_env(void *exec_env)
{
    g_exec_env = exec_env;
}

void *
dyntype_context_get_exec_env()
{
    return g_exec_env;
}

void
dyntype_set_callback_dispatcher(dyntype_callback_dispatcher_t callback)
{
    g_cb_dispatcher = callback;
}

dyntype_callback_dispatcher_t
dyntype_get_callback_dispatcher()
{
    return g_cb_dispatcher;
}

int
dyntype_execute_pending_jobs(dyn_ctx_t ctx)
{
    return dynamic_execute_pending_jobs(ctx);
}

void
dyntype_dump_error(dyn_ctx_t ctx)
{
    dynamic_dump_error(ctx);
}

dyn_value_t
dyntype_throw_exception(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_throw_exception(ctx, obj);
}

void
dyntype_dump_value(dyn_ctx_t ctx, dyn_value_t obj)
{
    dynamic_dump_value(ctx, obj);
}

int
dyntype_dump_value_buffer(dyn_ctx_t ctx, dyn_value_t obj, void *buffer, int len)
{
    return dynamic_dump_value_buffer(ctx, obj, buffer, len);
}

dyn_value_t
dyntype_hold(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_hold(ctx, obj);
}

void
dyntype_release(dyn_ctx_t ctx, dyn_value_t obj)
{
    dynamic_release(ctx, obj);
}

void
dyntype_collect(dyn_ctx_t ctx)
{
    dynamic_collect(ctx);
}

/********************************************/
/*     APIs exposed to wasm application     */
/********************************************/

#define EXTREF_NOT_ALLOWED(api_name, ret)                              \
    if (dyntype_is_extref(ctx, obj)) {                                 \
        extref_unsupported(                                            \
            "libdyntype: unsupport operation for extref: " #api_name); \
        return ret;                                                    \
    }

#define MIXED_TYPE_DISPATCH(api_name, ...)          \
    bool is_extref;                                 \
                                                    \
    is_extref = dyntype_is_extref(ctx, obj);        \
    if (is_extref) {                                \
        return extref_##api_name(ctx, __VA_ARGS__); \
    }                                               \
    return dynamic_##api_name(ctx, __VA_ARGS__);

dyn_ctx_t
dyntype_get_context()
{
    return dynamic_get_context();
}

dyn_value_t
dyntype_new_number(dyn_ctx_t ctx, double value)
{
    return dynamic_new_number(ctx, value);
}

dyn_value_t
dyntype_new_boolean(dyn_ctx_t ctx, bool value)
{
    return dynamic_new_boolean(ctx, value);
}

#if WASM_ENABLE_STRINGREF != 0
dyn_value_t
dyntype_new_string(dyn_ctx_t ctx, const void *stringref)
{
    return dynamic_new_string(ctx, stringref);
}
#else
dyn_value_t
dyntype_new_string(dyn_ctx_t ctx, const char *str, int len)
{
    return dynamic_new_string(ctx, str, len);
}
#endif

dyn_value_t
dyntype_new_undefined(dyn_ctx_t ctx)
{
    return dynamic_new_undefined(ctx);
}

dyn_value_t
dyntype_new_null(dyn_ctx_t ctx)
{
    return dynamic_new_null(ctx);
}

dyn_value_t
dyntype_new_object(dyn_ctx_t ctx)
{
    return dynamic_new_object(ctx);
}

dyn_value_t
dyntype_new_object_with_class(dyn_ctx_t ctx, const char *name, int argc,
                              dyn_value_t *args)
{
    return dynamic_new_object_with_class(ctx, name, argc, args);
}

dyn_value_t
dyntype_new_object_with_proto(dyn_ctx_t ctx, const dyn_value_t proto_obj)
{
    return dynamic_new_object_with_proto(ctx, proto_obj);
}

dyn_value_t
dyntype_new_array(dyn_ctx_t ctx, int len)
{
    return dynamic_new_array(ctx, len);
}

dyn_value_t
dyntype_new_extref(dyn_ctx_t ctx, void *ptr, external_ref_tag tag, void *opaque)
{
    return dynamic_new_extref(ctx, ptr, tag, opaque);
}

int
dyntype_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem)
{
    MIXED_TYPE_DISPATCH(set_elem, obj, index, elem)
}

dyn_value_t
dyntype_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index)
{
    MIXED_TYPE_DISPATCH(get_elem, obj, index)
}

int
dyntype_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value)
{
    MIXED_TYPE_DISPATCH(set_property, obj, prop, value)
}

dyn_value_t
dyntype_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    MIXED_TYPE_DISPATCH(get_property, obj, prop)
}

dyn_value_t
dyntype_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    MIXED_TYPE_DISPATCH(get_own_property, obj, prop)
}

int
dyntype_define_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                        dyn_value_t desc)
{
    EXTREF_NOT_ALLOWED(define_property, -DYNTYPE_TYPEERR)

    return dynamic_define_property(ctx, obj, prop, desc);
}

int
dyntype_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    MIXED_TYPE_DISPATCH(has_property, obj, prop)
}

int
dyntype_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    MIXED_TYPE_DISPATCH(delete_property, obj, prop)
}

bool
dyntype_is_number(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_number(ctx, obj);
}

int
dyntype_to_number(dyn_ctx_t ctx, dyn_value_t obj, double *pres)
{
    return dynamic_to_number(ctx, obj, pres);
}

bool
dyntype_is_bool(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_bool(ctx, obj);
}

int
dyntype_to_bool(dyn_ctx_t ctx, dyn_value_t bool_obj, bool *pres)
{
    return dynamic_to_bool(ctx, bool_obj, pres);
}

bool
dyntype_is_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_string(ctx, obj);
}

#if WASM_ENABLE_STRINGREF != 0
void *
dyntype_to_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_to_string(ctx, obj);
}
#endif

int
dyntype_to_cstring(dyn_ctx_t ctx, dyn_value_t str_obj, char **pres)
{
    return dynamic_to_cstring(ctx, str_obj, pres);
}

void
dyntype_free_cstring(dyn_ctx_t ctx, char *str)
{
    dynamic_free_cstring(ctx, str);
}

bool
dyntype_is_undefined(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_undefined(ctx, obj);
}

bool
dyntype_is_null(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_null(ctx, obj);
}

bool
dyntype_is_object(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_object(ctx, obj);
}

bool
dyntype_is_function(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_function(ctx, obj);
}

bool
dyntype_is_array(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_array(ctx, obj);
}

bool
dyntype_is_extref(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_is_extref(ctx, obj);
}

int
dyntype_to_extref(dyn_ctx_t ctx, dyn_value_t obj, void **pres)
{
    return dynamic_to_extref(ctx, obj, pres);
}

bool
dyntype_is_exception(dyn_ctx_t ctx, dyn_value_t value)
{
    return dynamic_is_exception(ctx, value);
}

bool dyntype_is_falsy(dyn_ctx_t ctx, dyn_value_t value)
{
    return dynamic_is_falsy(ctx, value);
}

dyn_type_t
dyntype_typeof(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_typeof(ctx, obj);
}

bool
dyntype_type_eq(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs)
{
    return dynamic_type_eq(ctx, lhs, rhs);
}

bool
dyntype_cmp(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs, cmp_operator operator_kind)
{
    return dynamic_cmp(ctx, lhs, rhs, operator_kind);
}

int
dyntype_set_prototype(dyn_ctx_t ctx, dyn_value_t obj,
                      const dyn_value_t proto_obj)
{
    EXTREF_NOT_ALLOWED(set_prototype, -DYNTYPE_TYPEERR)

    return dynamic_set_prototype(ctx, obj, proto_obj);
}

dyn_value_t
dyntype_get_prototype(dyn_ctx_t ctx, dyn_value_t obj)
{
    EXTREF_NOT_ALLOWED(get_prototype, NULL)

    return dynamic_get_prototype(ctx, obj);
}

bool
dyntype_instanceof(dyn_ctx_t ctx, const dyn_value_t src_obj,
                   const dyn_value_t dst_obj)
{
    return dynamic_instanceof(ctx, src_obj, dst_obj);
}

dyn_value_t
dyntype_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
               dyn_value_t *args)
{
    MIXED_TYPE_DISPATCH(invoke, name, obj, argc, args)
}

dyn_value_t
dyntype_get_global(dyn_ctx_t ctx, const char *name)
{
    return dynamic_get_global(ctx, name);
}

int
dyntype_get_array_length(dyn_ctx_t ctx, dyn_value_t obj)
{
    return dynamic_get_array_length(ctx, obj);
}
