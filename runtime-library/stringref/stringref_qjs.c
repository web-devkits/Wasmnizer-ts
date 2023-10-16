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
    dyntype_release(
        dyntype_get_context(),
        (dyn_value_t)wasm_stringview_wtf8_obj_get_value(stringview_wtf8_obj));
}

void
wasm_stringview_wtf16_obj_finalizer(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, void *data)
{
    dyntype_release(
        dyntype_get_context(),
        (dyn_value_t)wasm_stringview_wtf16_obj_get_value(stringview_wtf16_obj));
}

void
wasm_stringview_iter_obj_finalizer(
    WASMStringviewIterObjectRef stringview_iter_obj, void *data)
{
    dyntype_release(
        dyntype_get_context(),
        (dyn_value_t)wasm_stringview_iter_obj_get_value(stringview_iter_obj));
}

/******************* opcode functions *****************/

/* string.const */
WASMString
wasm_string_new_const(const char *str)
{
    return dyntype_new_string(dyntype_get_context(), "", 0);
}

/* string.new_xx8 */
/* string.new_wtf16 */
/* string.new_xx8_array */
/* string.new_wtf16_array */
WASMString
wasm_string_new_with_encoding(void *addr, uint32 count, EncodingFlag flag)
{
    if (flag == WTF8 || flag == UTF8 || flag == LOSSY_UTF8) {
        return dyntype_new_string(dyntype_get_context(), addr, count);
    }
    else {
        /* WTF16 */
        return NULL;
    }
}

/* string.measure */
/* stringview_wtf16.length */
int32
wasm_string_measure(WASMString str_obj, EncodingFlag flag)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t length_obj = NULL;
    double length = 0;

    length_obj = dyntype_get_property(dyn_ctx, (dyn_value_t)str_obj, "length");

    dyntype_to_number(dyn_ctx, length_obj, &length);
    dyntype_release(dyn_ctx, length_obj);
    return (int32)length;
}

/* stringview_wtf16.length */
int32
wasm_string_wtf16_get_length(WASMString str_obj)
{
    return wasm_string_measure(str_obj, WTF16);
}

/* string.encode_xx8 */
/* string.encode_wtf16 */
/* stringview_wtf8.encode_xx */
/* stringview_wtf16.encode */
/* string.encode_xx8_array */
/* string.encode_wtf16_array */
int32
wasm_string_encode(WASMString str_obj, uint32 pos, uint32 count, void *addr,
                   EncodingFlag flag)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    uint32_t str_len = 0;

    char *str = NULL;
    dyntype_to_cstring(dyn_ctx, str_obj, &str);
    str_len = strlen(str);

    bh_memcpy_s(addr, str_len, str, str_len);

    dyntype_free_cstring(dyn_ctx, str);
    return str_len;
}

/* string.concat */
WASMString
wasm_string_concat(WASMString str_obj1, WASMString str_obj2)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t concat_ret = NULL;

    concat_ret =
        dyntype_invoke(dyn_ctx, "concat", (dyn_value_t)str_obj1, 1, &str_obj2);

    return concat_ret;
}

/* string.eq */
int32
wasm_string_eq(WASMString str_obj1, WASMString str_obj2)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t compare_ret = NULL;
    double ret;

    compare_ret = dyntype_invoke(dyn_ctx, "localeCompare",
                                 (dyn_value_t)str_obj1, 1, &str_obj2);

    if (!compare_ret) {
        return 0;
    }

    dyntype_to_number(dyn_ctx, compare_ret, &ret);
    dyntype_release(dyn_ctx, compare_ret);
    return ret == 0 ? 1 : 0;
}

/* string.is_usv_sequence */
int32
wasm_string_is_usv_sequence(WASMString str_obj)
{
    return 0;
}

/* string.as_wtf8 */
/* string.as_wtf16 */
/* string.as_iter */
WASMString
wasm_string_create_view(WASMString str_obj, StringViewType type)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();

    return dyntype_hold(dyn_ctx, str_obj);
}

/* stringview_wtf8.advance */
/* stringview_iter.advance */
int32
wasm_string_advance(WASMString str_obj, uint32 pos, uint32 count,
                    uint32 *consumed)
{
    return 0;
}

/* stringview_wtf8.slice */
/* stringview_wtf16.slice */
/* stringview_iter.slice */
WASMString
wasm_string_slice(WASMString str_obj, uint32 start, uint32 end,
                  StringViewType type)
{
    dyn_ctx_t dyn_ctx = dyntype_get_context();
    dyn_value_t slice_ret = NULL,
                invoke_args[2] = { dyntype_new_number(dyn_ctx, start),
                                   dyntype_new_number(dyn_ctx, end) };

    slice_ret =
        dyntype_invoke(dyn_ctx, "slice", (dyn_value_t)str_obj, 2, invoke_args);

    dyntype_release(dyn_ctx, invoke_args[0]);
    dyntype_release(dyn_ctx, invoke_args[1]);

    return slice_ret;
}

/* stringview_wtf16.get_codeunit */
int16
wasm_string_get_wtf16_codeunit(WASMString str_obj, int32 pos)
{
    return 0;
}

/* stringview_iter.next */
uint32
wasm_string_next_codepoint(WASMString str_obj, uint32 pos)
{
    return 0;
}

/* stringview_iter.rewind */
uint32
wasm_string_rewind(WASMString str_obj, uint32 pos, uint32 count,
                   uint32 *consumed)
{
    return 0;
}

/******************* application functions *****************/
void
wasm_string_dump(WASMString str_obj, EncodingFlag flag)
{
    dyntype_dump_value(dyntype_get_context(), str_obj);
}
