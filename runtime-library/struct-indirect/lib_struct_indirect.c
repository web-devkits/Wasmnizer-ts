/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "gc_type.h"

static wasm_struct_obj_t
check_struct_obj_type(wasm_exec_env_t exec_env, wasm_obj_t obj, int index,
                      uint8_t type)
{
    wasm_module_inst_t module_inst = wasm_runtime_get_module_inst(exec_env);
    wasm_struct_type_t struct_type;
    wasm_ref_type_t field_ref_type;
    uint8 field_type;
    bool is_mutable;

    if (!wasm_obj_is_struct_obj(obj)) {
        wasm_runtime_set_exception(
            module_inst, "can't access field of non-struct reference");
        return NULL;
    }

    struct_type = (wasm_struct_type_t)wasm_obj_get_defined_type(obj);
    if (index < 0 || index >= wasm_struct_type_get_field_count(struct_type)) {
        wasm_runtime_set_exception(module_inst,
                                   "struct field index out of bounds");
        return NULL;
    }

    field_ref_type =
        wasm_struct_type_get_field_type(struct_type, index, &is_mutable);
    field_type = field_ref_type.value_type;
    if (!((field_type == type)
          || (type == VALUE_TYPE_ANYREF && wasm_is_type_reftype(field_type)))) {
        wasm_runtime_set_exception(module_inst, "struct field type mismatch");
        return NULL;
    }

    return (wasm_struct_obj_t)obj;
}

int
struct_get_indirect_i32(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_I32);
    if (!struct_obj) {
        return 0;
    }

    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.i32;
}

long long
struct_get_indirect_i64(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_I64);
    if (!struct_obj) {
        return 0;
    }

    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.i64;
}

float
struct_get_indirect_f32(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_F32);
    if (!struct_obj) {
        return 0;
    }

    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.f32;
}

double
struct_get_indirect_f64(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_F64);
    if (!struct_obj) {
        return 0;
    }

    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.f64;
}

void *
struct_get_indirect_anyref(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj,
                      int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj = check_struct_obj_type(
        exec_env, (wasm_obj_t)obj, index, REF_TYPE_ANYREF);
    if (!struct_obj) {
        return NULL;
    }

    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.gc_obj;
}

void *
struct_get_indirect_funcref(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj,
                       int index)
{
    wasm_value_t result = { 0 };
    wasm_struct_obj_t struct_obj = check_struct_obj_type(
        exec_env, (wasm_obj_t)obj, index, REF_TYPE_ANYREF);
    if (!struct_obj) {
        return NULL;
    }
    wasm_struct_obj_get_field(struct_obj, index, false, &result);

    return result.gc_obj;
}

void
struct_set_indirect_i32(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index,
                   int value)
{
    wasm_value_t val = { .i32 = value };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_I32);
    if (!struct_obj) {
        return;
    }

    wasm_struct_obj_set_field(struct_obj, index, &val);
}

void
struct_set_indirect_i64(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index,
                   long long value)
{
    wasm_value_t val = { .i64 = value };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_I64);
    if (!struct_obj) {
        return;
    }

    wasm_struct_obj_set_field(struct_obj, index, &val);
}

void
struct_set_indirect_f32(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index,
                   float value)
{
    wasm_value_t val = { .f32 = value };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_F32);
    if (!struct_obj) {
        return;
    }

    wasm_struct_obj_set_field(struct_obj, index, &val);
}

void
struct_set_indirect_f64(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj, int index,
                   double value)
{
    wasm_value_t val = { .f64 = value };
    wasm_struct_obj_t struct_obj =
        check_struct_obj_type(exec_env, (wasm_obj_t)obj, index, VALUE_TYPE_F64);
    if (!struct_obj) {
        return;
    }

    wasm_struct_obj_set_field(struct_obj, index, &val);
}

void
struct_set_indirect_anyref(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj,
                      int index, void *value)
{
    wasm_value_t val = { .gc_obj = value };
    wasm_struct_obj_t struct_obj = check_struct_obj_type(
        exec_env, (wasm_obj_t)obj, index, REF_TYPE_ANYREF);
    if (!struct_obj) {
        return;
    }

    wasm_struct_obj_set_field(struct_obj, index, &val);
}

void
struct_set_indirect_funcref(wasm_exec_env_t exec_env, wasm_anyref_obj_t obj,
                       int index, void *value)
{
    wasm_value_t val = { .gc_obj = value };
    wasm_struct_obj_t struct_obj = check_struct_obj_type(
        exec_env, (wasm_obj_t)obj, index, REF_TYPE_ANYREF);
    if (!struct_obj) {
        return;
    }
    wasm_struct_obj_set_field(struct_obj, index, &val);
}

/* clang-format off */
#define REG_NATIVE_FUNC(func_name, signature) \
    { #func_name, func_name, signature, NULL }

static NativeSymbol native_symbols[] = {
    REG_NATIVE_FUNC(struct_get_indirect_i32, "(ri)i"),
    REG_NATIVE_FUNC(struct_get_indirect_i64, "(ri)I"),
    REG_NATIVE_FUNC(struct_get_indirect_f32, "(ri)f"),
    REG_NATIVE_FUNC(struct_get_indirect_f64, "(ri)F"),
    REG_NATIVE_FUNC(struct_get_indirect_anyref, "(ri)r"),
    REG_NATIVE_FUNC(struct_get_indirect_funcref, "(ri)r"),
    REG_NATIVE_FUNC(struct_set_indirect_i32, "(rii)"),
    REG_NATIVE_FUNC(struct_set_indirect_i64, "(riI)"),
    REG_NATIVE_FUNC(struct_set_indirect_f32, "(rif)"),
    REG_NATIVE_FUNC(struct_set_indirect_f64, "(riF)"),
    REG_NATIVE_FUNC(struct_set_indirect_anyref, "(rir)"),
    REG_NATIVE_FUNC(struct_set_indirect_funcref, "(rir)"),
};
/* clang-format on */

uint32_t
get_struct_indirect_symbols(char **p_module_name, NativeSymbol **p_native_symbols)
{
    *p_module_name = "libstruct_indirect";
    *p_native_symbols = native_symbols;
    return sizeof(native_symbols) / sizeof(NativeSymbol);
}
