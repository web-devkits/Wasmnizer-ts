/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "pure_dynamic.h"
#include <assert.h>

/******************* function fallback *******************/
dyn_value_t
dynamic_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
               dyn_value_t *args)
{
    assert(0);
    return NULL;
}

int
dynamic_execute_pending_jobs(dyn_ctx_t ctx)
{
    return 0;
}
