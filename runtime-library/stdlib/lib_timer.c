/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "bh_hashmap.h"
#include "wasm_export.h"

wasm_exec_env_t env;
HashMap *timer_map;
void *(*_createTimer)(uint64_t timeout);
bool (*_destroyTimer)(void *timer_id);

double
setTimeout(wasm_exec_env_t exec_env, void *closure, double delay, void *args)
{
    void *timer_id = NULL;

    env = exec_env;
    if (_createTimer != NULL) {
        timer_id = _createTimer(delay);
        bh_hash_map_insert(timer_map, timer_id, closure);
        return (double)(uintptr_t)(timer_id);
    }
    return 0;
}

void
clearTimeout(wasm_exec_env_t exec_env, double id)
{
    void *timer_id = (void *)(uintptr_t)id;

    if (id == 0) {
        return;
    }
    if (_destroyTimer != NULL) {
        _destroyTimer(timer_id);
    }
}

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name, signature, NULL }

static NativeSymbol native_symbols[] = {
    REG_NATIVE_FUNC(setTimeout, "(rFr)F"),
    REG_NATIVE_FUNC(clearTimeout, "(F)"),
};
/* clang-format on */

uint32_t
get_lib_timer_symbols(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "env";
    *p_native_symbols = native_symbols;

    return sizeof(native_symbols) / sizeof(NativeSymbol);
}
