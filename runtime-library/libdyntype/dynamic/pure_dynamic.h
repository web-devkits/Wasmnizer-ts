/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __PURE_DYNAMIC_H_
#define __PURE_DYNAMIC_H_

#include "libdyntype.h"

#ifdef __cplusplus
extern "C" {
#endif

/********************************************/
/*     APIs exposed to runtime embedder     */
/********************************************/
dyn_ctx_t
dynamic_context_init();

dyn_ctx_t
dynamic_context_init_with_opt(dyn_options_t *options);

void
dynamic_context_destroy(dyn_ctx_t ctx);

int
dynamic_execute_pending_jobs(dyn_ctx_t ctx);

void
dynamic_dump_error(dyn_ctx_t ctx);

dyn_value_t
dynamic_throw_exception(dyn_ctx_t ctx, dyn_value_t obj);

void
dynamic_dump_value(dyn_ctx_t ctx, dyn_value_t obj);

int
dynamic_dump_value_buffer(dyn_ctx_t ctx, dyn_value_t obj, void *buffer,
                          int len);

dyn_value_t
dynamic_hold(dyn_ctx_t ctx, dyn_value_t obj);

void
dynamic_release(dyn_ctx_t ctx, dyn_value_t obj);

void
dynamic_collect(dyn_ctx_t ctx);

/********************************************/
/*     APIs exposed to wasm application     */
/********************************************/
dyn_ctx_t
dynamic_get_context();

dyn_value_t
dynamic_new_number(dyn_ctx_t ctx, double value);

dyn_value_t
dynamic_new_boolean(dyn_ctx_t ctx, bool value);

#if WASM_ENABLE_STRINGREF != 0
dyn_value_t
dynamic_new_string(dyn_ctx_t ctx, const void *stringref);
#else
dyn_value_t
dynamic_new_string(dyn_ctx_t ctx, const char *str, int len);
#endif

dyn_value_t
dynamic_new_undefined(dyn_ctx_t ctx);

dyn_value_t
dynamic_new_null(dyn_ctx_t ctx);

dyn_value_t
dynamic_new_object(dyn_ctx_t ctx);

dyn_value_t
dynamic_new_object_with_proto(dyn_ctx_t ctx, const dyn_value_t proto_obj);

dyn_value_t
dynamic_new_object_with_class(dyn_ctx_t ctx, const char *name, int argc,
                              dyn_value_t *args);

dyn_value_t
dynamic_new_array(dyn_ctx_t ctx, int len);

dyn_value_t
dynamic_new_extref(dyn_ctx_t ctx, void *ptr, external_ref_tag tag, void* opaque);

int
dynamic_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem);

dyn_value_t
dynamic_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index);

int
dynamic_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value);

dyn_value_t
dynamic_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

dyn_value_t
dynamic_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

int
dynamic_define_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                        dyn_value_t desc);

int
dynamic_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

int
dynamic_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

bool
dynamic_is_number(dyn_ctx_t ctx, dyn_value_t obj);
int
dynamic_to_number(dyn_ctx_t ctx, dyn_value_t obj, double *pres);

bool
dynamic_is_bool(dyn_ctx_t ctx, dyn_value_t obj);
int
dynamic_to_bool(dyn_ctx_t ctx, dyn_value_t bool_obj, bool *pres);

bool
dynamic_is_string(dyn_ctx_t ctx, dyn_value_t obj);

#if WASM_ENABLE_STRINGREF != 0
void *
dynamic_to_string(dyn_ctx_t ctx, dyn_value_t obj);
#endif

int
dynamic_to_cstring(dyn_ctx_t ctx, dyn_value_t str_obj, char **pres);
void
dynamic_free_cstring(dyn_ctx_t ctx, char *str);

bool
dynamic_is_undefined(dyn_ctx_t ctx, dyn_value_t obj);
bool
dynamic_is_null(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_is_object(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_is_function(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_is_array(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_is_extref(dyn_ctx_t ctx, dyn_value_t obj);

int
dynamic_to_extref(dyn_ctx_t ctx, dyn_value_t obj, void **pres);

bool
dynamic_is_exception(dyn_ctx_t ctx, dyn_value_t value);

bool
dynamic_is_falsy(dyn_ctx_t ctx, dyn_value_t value);

dyn_type_t
dynamic_typeof(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_type_eq(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs);

bool
dynamic_cmp(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs, cmp_operator operator_kind);

int
dynamic_set_prototype(dyn_ctx_t ctx, dyn_value_t obj,
                      const dyn_value_t proto_obj);

dyn_value_t
dynamic_get_prototype(dyn_ctx_t ctx, dyn_value_t obj);

bool
dynamic_instanceof(dyn_ctx_t ctx, const dyn_value_t src_obj,
                   const dyn_value_t dst_obj);

dyn_value_t
dynamic_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t this_obj, int argc,
               dyn_value_t *args);

dyn_value_t
dynamic_get_global(dyn_ctx_t ctx, const char *name);

dyn_value_t
dynamic_get_keys(dyn_ctx_t ctx, dyn_value_t obj);

/******************* Special Property Access *******************/

int
dynamic_get_array_length(dyn_ctx_t ctx, dyn_value_t obj);

#ifdef __cplusplus
}
#endif

#endif /* end of  __PURE_DYNAMIC_H_ */
