/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "pure_dynamic.h"

/* We don't need a context for simple libdyntype implementation, but we return a
 * non-zero value to make the system work */
static dyn_ctx_t g_dynamic_context = (dyn_ctx_t)(uintptr_t)0xffff;

/******************* Initialization and destroy *****************/

dyn_ctx_t
dynamic_context_init()
{
    return g_dynamic_context;
}

dyn_ctx_t
dynamic_context_init_with_opt(dyn_options_t *options)
{
    return g_dynamic_context;
}

void
dynamic_context_destroy(dyn_ctx_t ctx)
{}

dyn_ctx_t
dynamic_get_context()
{
    return g_dynamic_context;
}
