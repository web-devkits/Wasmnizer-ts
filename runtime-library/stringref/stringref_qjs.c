/*
 * Copyright (C) 2019 Intel Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype.h"
#include "string_object.h"
#include "libdyntype_export.h"

/******************* gc finalizer *****************/

void
wasm_stringref_obj_finalizer(WASMStringrefObjectRef stringref_obj, void *data)
{
    dyntype_release(dyntype_get_context(),
                    (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj));
}

void
wasm_stringview_wtf8_obj_finalizer(
    WASMStringviewWTF8ObjectRef stringview_wtf8_obj, void *data)
{

}

void
wasm_stringview_wtf16_obj_finalizer(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, void *data)
{

}

void
wasm_stringview_iter_obj_finalizer(
    WASMStringviewIterObjectRef stringview_iter_obj, void *data)
{

}

/******************* opcode functions *****************/

/* string.const */
WASMStringrefObjectRef
wasm_stringref_obj_new_with_const(struct WASMExecEnv *exec_env,
                                  WASMStringWTF8 *str_obj)
{
    return NULL;
}

/* string.new_xx8 */
WASMStringrefObjectRef
wasm_stringref_obj_new_with_8bit_memory(struct WASMExecEnv *exec_env,
                                        void *maddr, uint32 bytes_length,
                                        encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    dyn_value_t str = dyntype_new_string(dyntype_get_context(), maddr, bytes_length);

    if (!str) {
        wasm_runtime_set_exception(module_inst, "allocate memory failed");
        return NULL;
    }

    return wasm_stringref_obj_new(exec_env, str);
}

/* string.new_wtf16 */
WASMStringrefObjectRef
wasm_stringref_obj_new_with_16bit_memory(struct WASMExecEnv *exec_env,
                                         void *maddr, uint32 bytes_length)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.measure */
int32
wasm_stringref_obj_measure(WASMStringrefObjectRef stringref_obj,
                           encoding_flag flag)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t length_obj = NULL;
    double length = 0;

    length_obj = dyntype_get_property(
        dyn_ctx, (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj),
        "length");
    
    dyntype_to_number(dyn_ctx, length_obj, &length);
    dyntype_release(dyn_ctx, length_obj);
    return (int32)length;
}

/* string.encode_xx8 */
int32
wasm_stringref_obj_encode_with_8bit_memory(struct WASMExecEnv *exec_env,
                                           void *maddr,
                                           WASMStringrefObjectRef stringref_obj,
                                           encoding_flag flag)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t str_obj =
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj);
    uint32_t str_len = 0;

    char *str = NULL;
    dyntype_to_cstring(dyn_ctx, str_obj, &str);
    str_len = strlen(str);

    bh_memcpy_s(maddr, str_len, str, str_len);
    return str_len;
}

/* string.encode_wtf16 */
int32
wasm_stringref_obj_encode_with_16bit_memory(
    struct WASMExecEnv *exec_env, void *maddr,
    WASMStringrefObjectRef stringref_obj, encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/* string.concat */
WASMStringrefObjectRef
wasm_stringref_obj_concat(struct WASMExecEnv *exec_env,
                          WASMStringrefObjectRef stringref_obj1,
                          WASMStringrefObjectRef stringref_obj2)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t concat_ret = NULL;
    dyn_value_t stringref2 =
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj2);
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);

    concat_ret = dyntype_invoke(
        dyn_ctx, "concat",
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj1), 1,
        &stringref2);
    if (!concat_ret) {
        wasm_runtime_set_exception(module_inst, "failed to concat stringref");
    }

    return wasm_stringref_obj_new(exec_env, concat_ret);
}

/* string.eq */
int32
wasm_stringref_obj_eq(WASMStringrefObjectRef stringref_obj1,
                      WASMStringrefObjectRef stringref_obj2)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t compare_ret = NULL;
    double ret;
    dyn_value_t stringref2 =
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj2);

    compare_ret = dyntype_invoke(
        dyn_ctx, "localeCompare",
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj1), 1,
        &stringref2);
    
    if (!compare_ret) {
        return 0;
    }

    dyntype_to_number(dyn_ctx, compare_ret, &ret);
    dyntype_release(dyn_ctx, compare_ret);
    return ret == 0 ? 1 : 0;
}

/* string.is_usv_sequence */
int32
wasm_stringref_obj_is_usv_sequence(WASMStringrefObjectRef stringref_obj)
{
    return 0;
}

/* string.as_wtf8 */
WASMStringviewWTF8ObjectRef
wasm_stringview_wtf8_obj_new_by_stringref(struct WASMExecEnv *exec_env,
                                          WASMStringrefObjectRef stringref_obj)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* stringview_wtf8.advance */
int32
wasm_stringview_wtf8_obj_advance(
    struct WASMExecEnv *exec_env,
    WASMStringviewWTF8ObjectRef stringview_wtf8_obj, uint32 pos,
    uint32 bytes_length)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/* stringview_wtf8.encode_xx */
int32
wasm_stringview_wtf8_obj_encode_memory(
    struct WASMExecEnv *exec_env, void *maddr,
    WASMStringviewWTF8ObjectRef stringview_wtf8_obj, uint32 pos,
    uint32 bytes_length, uint32 *next_pos, encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/* stringview_wtf8.slice */
WASMStringrefObjectRef
wasm_stringview_wtf8_obj_slice(struct WASMExecEnv *exec_env,
                               WASMStringviewWTF8ObjectRef stringview_wtf8_obj,
                               uint32 start, uint32 end)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.as_wtf16 */
WASMStringviewWTF16ObjectRef
wasm_stringview_wtf16_obj_new_by_stringref(struct WASMExecEnv *exec_env,
                                           WASMStringrefObjectRef stringref_obj)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* stringview_wtf16.length */
int32
wasm_stringview_wtf16_obj_get_length(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj)
{
    return 0;
}

/* stringview_wtf16.get_codeunit */
int16
wasm_stringview_wtf16_obj_get_codeunit_at_pos(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, int32 pos)
{
    return 0;
}

/* stringview_wtf16.encode */
int32
wasm_stringview_wtf16_obj_encode_memory(
    struct WASMExecEnv *exec_env, void *maddr,
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, uint32 pos, uint32 len)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/* stringview_wtf16.slice */
WASMStringrefObjectRef
wasm_stringview_wtf16_obj_slice(
    struct WASMExecEnv *exec_env,
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, uint32 start, uint32 end)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.as_iter */
WASMStringviewIterObjectRef
wasm_stringview_iter_obj_new_by_stringref(struct WASMExecEnv *exec_env,
                                          WASMStringrefObjectRef stringref_obj)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* stringview_iter.next */
uint32
wasm_stringview_iter_obj_get_next_codepoint(
    WASMStringviewIterObjectRef stringview_iter_obj)
{
    return 0;
}

/* stringview_iter.advance */
uint32
wasm_stringview_iter_obj_advance(
    WASMStringviewIterObjectRef stringview_iter_obj, uint32 code_points_count)
{
    return 0;
}

/* stringview_iter.rewind */
uint32
wasm_stringview_iter_obj_rewind(WASMStringviewIterObjectRef stringview_iter_obj,
                                uint32 code_points_count)
{
    return 0;
}

/* stringview_iter.slice */
WASMStringrefObjectRef
wasm_stringview_iter_obj_slice(struct WASMExecEnv *exec_env,
                               WASMStringviewIterObjectRef stringview_iter_obj,
                               uint32 code_points_count)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.new_xx8_array */
WASMStringrefObjectRef
wasm_stringref_obj_new_with_8bit_array(struct WASMExecEnv *exec_env,
                                       WASMArrayObjectRef array_obj,
                                       uint32 start, uint32 end,
                                       encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.new_wtf16_array */
WASMStringrefObjectRef
wasm_stringref_obj_new_with_16bit_array(struct WASMExecEnv *exec_env,
                                        WASMArrayObjectRef array_obj,
                                        uint32 start, uint32 end)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return NULL;
}

/* string.encode_xx8_array */
uint32
wasm_stringref_obj_encode_with_8bit_array(struct WASMExecEnv *exec_env,
                                          WASMStringrefObjectRef stringref_obj,
                                          WASMArrayObjectRef array_obj,
                                          uint32 start, encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/* string.encode_wtf16_array */
uint32
wasm_stringref_obj_encode_with_16bit_array(struct WASMExecEnv *exec_env,
                                           WASMStringrefObjectRef stringref_obj,
                                           WASMArrayObjectRef array_obj,
                                           uint32 start, encoding_flag flag)
{
    wasm_module_inst_t module_inst = wasm_exec_env_get_module_inst(exec_env);
    wasm_runtime_set_exception(module_inst, "unimplemented");
    return 0;
}

/******************* application functions *****************/

void
wasm_stringref_obj_dump(WASMStringrefObjectRef stringref_obj)
{
    dyntype_dump_value(
        dyntype_get_context(),
        (dyn_value_t)wasm_stringref_obj_get_value(stringref_obj));
}

char *
wasm_stringview_wtf8_obj_convert_char(
    WASMStringviewWTF8ObjectRef stringview_wtf8_obj)
{
    return NULL;
}

char *
wasm_stringview_wtf16_obj_convert_char(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj)
{
    return NULL;
}
