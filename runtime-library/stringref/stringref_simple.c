/*
 * Copyright (C) 2023 Intel Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "string_object.h"
#include "pure_dynamic.h"
#include "dyn_value.h"

/******************* gc finalizer *****************/
void
wasm_string_destroy(WASMString str_obj)
{
    dynamic_release(NULL, str_obj);
}
/******************* opcode functions *****************/

/* string.const */
WASMString
wasm_string_new_const(const char *content, uint32 length)
{
    return dyn_value_new_string(content, length);
}

/* string.new_xx8 */
/* string.new_wtf16 */
/* string.new_xx8_array */
/* string.new_wtf16_array */
WASMString
wasm_string_new_with_encoding(void *addr, uint32 count, EncodingFlag flag)
{
    return dyn_value_new_string(addr, count);
}

/* string.measure */
/* stringview_wtf16.length */
int32
wasm_string_measure(WASMString str_obj, EncodingFlag flag)
{
    return ((DyntypeString *)str_obj)->length;
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
    DyntypeString *dyn_str = (DyntypeString *)str_obj;
    uint32_t len = dyn_str->length;

    /* If addr == NULL, just calculate the required length */
    if (addr) {
        bh_memcpy_s(addr, len, dyn_str->data, len);
    }

    if (next_pos) {
        *next_pos = pos + count;
    }

    return len;
}

/* string.concat */
WASMString
wasm_string_concat(WASMString str_obj1, WASMString str_obj2)
{
    return dyn_string_concat(str_obj1, str_obj2);
}

/* string.eq */
int32
wasm_string_eq(WASMString str_obj1, WASMString str_obj2)
{
    return dyn_string_eq(str_obj1, str_obj2);
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
    DyntypeString *dyn_str = (DyntypeString *)str_obj;

    dyn_str->header.ref_count++;

    return dyn_str;
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
    return dyn_string_slice(str_obj, start, end);
}

/* stringview_wtf16.get_codeunit */
int16
wasm_string_get_wtf16_codeunit(WASMString str_obj, int32 pos)
{
    DyntypeString *dyn_str = (DyntypeString *)str_obj;

    return dyn_str->data[pos];
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
    DyntypeString *dyn_str = (DyntypeString *)str_obj;

    fwrite(dyn_str->data, 1, dyn_str->length, stdout);
}
