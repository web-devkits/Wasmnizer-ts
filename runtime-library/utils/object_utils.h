/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __OBJECT_UTILS_H_
#define __OBJECT_UTILS_H_

#include "gc_export.h"
#include "libdyntype.h"

dyn_value_t
box_value_to_any(wasm_exec_env_t exec_env, dyn_ctx_t ctx, wasm_value_t *value,
                 wasm_ref_type_t type, bool is_get_property, int index);

void
unbox_value_from_any(wasm_exec_env_t exec_env, dyn_ctx_t ctx, void *obj,
                     wasm_ref_type_t type, wasm_value_t *unboxed_value,
                     bool is_set_property, int index);

dyn_value_t
call_wasm_func_with_boxing(wasm_exec_env_t exec_env, dyn_ctx_t ctx,
                           wasm_anyref_obj_t func_any_obj, uint32_t argc,
                           dyn_value_t *func_args);

#if WASM_ENABLE_STRINGREF != 0
bool
string_compare(wasm_stringref_obj_t lhs, wasm_stringref_obj_t rhs);
#endif

#endif /* end of __OBJECT_UTILS_H_ */
