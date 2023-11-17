/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "gc_export.h"
#include "bh_platform.h"
#include "quickjs.h"
#include "libdyntype_export.h"

void *
Console_constructor(wasm_exec_env_t exec_env, void *obj)
{
    return obj;
}

void
Console_log(wasm_exec_env_t exec_env, void *thiz, void *obj)
{
    uint32_t i, len;
    wasm_value_t wasm_array_data = { 0 }, wasm_array_len = { 0 };
    wasm_struct_obj_t arr_struct_ref;
    wasm_array_obj_t arr_ref;
    wasm_obj_t obj_ref = (wasm_obj_t)obj;

    assert(wasm_obj_is_struct_obj(obj_ref));
    arr_struct_ref = (wasm_struct_obj_t)obj_ref;
    wasm_struct_obj_get_field(arr_struct_ref, 0, false, &wasm_array_data);
    wasm_struct_obj_get_field(arr_struct_ref, 1, false, &wasm_array_len);

    arr_ref = (wasm_array_obj_t)(wasm_array_data.gc_obj);
    len = wasm_array_len.i32;
    for (i = 0; i < len; i++) {
        void *addr = wasm_array_obj_elem_addr(arr_ref, i);
        wasm_anyref_obj_t anyref = *((wasm_anyref_obj_t *)addr);
        JSValue *js_value = (JSValue *)wasm_anyref_obj_get_value(anyref);
        if (dyntype_is_extref(dyntype_get_context(), js_value)) {
            printf("[wasm object]");
        }
        else {
            dyntype_dump_value(dyntype_get_context(), js_value);
        }

        if (i < len - 1) {
            printf(" ");
        }
    }
    printf("\n");
}

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name, signature, NULL }

static NativeSymbol native_symbols[] = {
    REG_NATIVE_FUNC(Console_constructor, "(r)r"),
    REG_NATIVE_FUNC(Console_log, "(rr)"),
    /* TODO */
};
/* clang-format on */

uint32_t
get_lib_console_symbols(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "env";
    *p_native_symbols = native_symbols;
    return sizeof(native_symbols) / sizeof(NativeSymbol);
}
