/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __EXTREF_H_
#define __EXTREF_H_

#include "libdyntype.h"

int
extref_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem);

dyn_value_t
extref_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index);

int
extref_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value);

dyn_value_t
extref_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

dyn_value_t
extref_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

int
extref_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

int
extref_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

dyn_value_t
extref_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
              dyn_value_t *args);

void
extref_unsupported(const char *reason);

#endif /* end of __EXTREF_H_ */
