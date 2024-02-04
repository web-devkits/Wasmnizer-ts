/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "dyn_class.h"

DynValue *string_concat(DynValue *this_val, int argc, DynValue *argv[])
{
    uint32_t i;
    DyntypeString *res, *this_str = (DyntypeString *)this_val;
    uint64_t total_string_len = this_str->length;
    uint64_t total_size;

    for (i = 0; i < argc; i++) {
        total_string_len += ((DyntypeString *)argv[i])->length;
    }
    total_size = total_string_len + offsetof(DyntypeString, data) + 1;

    if (total_size >= UINT32_MAX) {
        return NULL;
    }

    res = (DyntypeString *)wasm_runtime_malloc(total_size);
    if (!res) {
        return NULL;
    }
    memset(res, 0, total_size);

    res->header.type = DynString;
    res->header.ref_count = 1;
    res->header.class_id = DynClassString;
    res->length = this_str->length;

    bh_memcpy_s(res->data, res->length, this_str->data, this_str->length);

    for (i = 0; i < argc; i++) {
        DyntypeString *str = (DyntypeString *)argv[i];
        bh_memcpy_s(res->data + res->length, str->length, str->data,
                    str->length);
        res->length += str->length;
    }

    assert(res->length == total_string_len);

    return (DynValue *)res;
}

ClassMethod string_inst_methods[] = { 
    { "concat", string_concat },
    /* TODO: add more methods */
};

ClassMeta string_class_meta = {
    .constructor = NULL,
    .parent_class_id = DynClassObject,
    .inst_method_num = sizeof(string_inst_methods) / sizeof(ClassMethod),
    .inst_methods = string_inst_methods,
    .name = "String"
};
