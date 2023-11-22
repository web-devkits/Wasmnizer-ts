/*
 * Copyright (C) 2019 Intel Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "string_object.h"
#include "quickjs.h"
#include "dynamic/type.h"

static JSValue
invoke_method(JSValue obj, const char *method, int argc, JSValue *args)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSContext *js_ctx = dyn_ctx->js_ctx;

    // JSClassCall *call_func = NULL;
    JSValue func = JS_GetPropertyStr(js_ctx, obj, method);
    JSValue ret;

    ret = JS_Call(js_ctx, func, obj, argc, args);
    JS_FreeValue(js_ctx, func);

    return ret;
}

/******************* gc finalizer *****************/
void
wasm_string_destroy(WASMString str_obj)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, (void *)str_obj);
    JS_FreeValue(dyn_ctx->js_ctx, js_str);
}
/******************* opcode functions *****************/

/* string.const */
WASMString
wasm_string_new_const(const char *content, uint32 length)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str = JS_NewStringLen(dyn_ctx->js_ctx, content, length);

    return JS_VALUE_GET_PTR(js_str);
}

/* string.new_xx8 */
/* string.new_wtf16 */
/* string.new_xx8_array */
/* string.new_wtf16_array */
WASMString
wasm_string_new_with_encoding(void *addr, uint32 count, EncodingFlag flag)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str = JS_NewStringLen(dyn_ctx->js_ctx, addr, count);

    return JS_VALUE_GET_PTR(js_str);
}

/* string.measure */
/* stringview_wtf16.length */
int32
wasm_string_measure(WASMString str_obj, EncodingFlag flag)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, str_obj);
    JSValue length;

    length = JS_GetPropertyStr(dyn_ctx->js_ctx, js_str, "length");

    return JS_VALUE_GET_INT(length);
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
                   uint32 *next_pos, EncodingFlag flag)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, str_obj);
    const char *str = NULL;
    size_t str_len = 0;

    str = JS_ToCStringLen(dyn_ctx->js_ctx, &str_len, js_str);

    /* If addr == NULL, just calculate the required length */
    if (addr) {
        bh_memcpy_s(addr, str_len, str, str_len);
    }

    if (next_pos) {
        *next_pos = pos + count;
    }

    JS_FreeCString(dyn_ctx->js_ctx, str);
    return str_len;
}

/* string.concat */
WASMString
wasm_string_concat(WASMString str_obj1, WASMString str_obj2)
{
    JSValue js_str1 = JS_MKPTR(JS_TAG_STRING, str_obj1);
    JSValue js_str2 = JS_MKPTR(JS_TAG_STRING, str_obj2);
    JSValue js_str_res;

    js_str_res = invoke_method(js_str1, "concat", 1, &js_str2);
    return JS_VALUE_GET_PTR(js_str_res);
}

/* string.eq */
int32
wasm_string_eq(WASMString str_obj1, WASMString str_obj2)
{
    JSValue js_str1 = JS_MKPTR(JS_TAG_STRING, str_obj1);
    JSValue js_str2 = JS_MKPTR(JS_TAG_STRING, str_obj2);
    JSValue res;

    res = invoke_method(js_str1, "localeCompare", 1, &js_str2);

    return JS_VALUE_GET_INT(res) == 0 ? 1 : 0;
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
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSValue js_str1 = JS_MKPTR(JS_TAG_STRING, str_obj);

    JS_DupValue(dyn_ctx->js_ctx, js_str1);
    return str_obj;
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
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSContext *js_ctx = dyn_ctx->js_ctx;
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, str_obj);
    JSValue args[2] = { JS_NewFloat64(js_ctx, start),
                        JS_NewFloat64(js_ctx, end) };
    JSValue js_str_res;

    js_str_res = invoke_method(js_str, "slice", 2, args);
    return JS_VALUE_GET_PTR(js_str_res);
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
wasm_string_dump(WASMString str_obj)
{
    DynTypeContext *dyn_ctx = dyntype_get_context();
    JSContext *js_ctx = dyn_ctx->js_ctx;
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, str_obj);
    const char *str;
    size_t len;

    str = JS_ToCStringLen(js_ctx, &len, js_str);
    fwrite(str, 1, len, stdout);
    JS_FreeCString(js_ctx, str);
}
