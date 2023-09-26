/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "wasm_export.h"

/**
 * @brief Get element from wasm table by index
 *
 * @param exec_env wasm execution environment
 * @param index element index
 *
 * @return the element stored in the table slot, for GC objects, it's wasm_obj_t
 */
void *
wamr_utils_get_table_element(wasm_exec_env_t exec_env, uint32_t index);
