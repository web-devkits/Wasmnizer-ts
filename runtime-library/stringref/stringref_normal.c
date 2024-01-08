/*
 * Copyright (C) 2023 Intel Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "string_object.h"

typedef enum SourceFlag {
    Bit8,
    Bit16,
} SourceFlag;

typedef struct WASMStringImpl {
    int32 length;
    int32 ref_count;
    bool is_const;
    SourceFlag source_flag;
    union {
        uint8 *bytes;
        uint16 *code_units;
    } u;
} WASMStringImpl;

/******************* encoding utilities *****************/

static bool
is_high_surrogate(uint32 code_point)
{
    return (code_point >= 0xD800 && code_point <= 0xDBFF);
}

static bool
is_low_surrogate(uint32 code_point)
{
    return (code_point >= 0xDC00 && code_point <= 0xDFFF);
}

static bool
is_isolated_surrogate(uint32 code_point)
{
    return (code_point >= 0xD800 && code_point <= 0xDFFF);
}

static bool
is_supplementary_code_point(uint32 code_point)
{
    return (code_point >= 0x10000 && code_point <= 0x10FFFF);
}

static bool
is_BMP_code_point(uint32 code_point)
{
    return (code_point <= 0xFFFF);
}

static bool
is_wtf8_codepoint_start(uint8 *bytes, uint32 pos)
{
    return ((*(bytes + pos)) & 0xC0) != 0x80;
}

static uint32
align_wtf8_sequential(uint8 *bytes, uint32 pos, uint32 bytes_length)
{
    if (pos >= bytes_length) {
        return bytes_length;
    }

    if (is_wtf8_codepoint_start(bytes, pos)) {
        return pos;
    }

    if (pos + 1 == bytes_length) {
        return pos + 1;
    }
    if (is_wtf8_codepoint_start(bytes, pos + 1)) {
        return pos + 1;
    }

    if (pos + 2 == bytes_length) {
        return pos + 2;
    }
    if (is_wtf8_codepoint_start(bytes, pos + 2)) {
        return pos + 2;
    }

    return pos + 3;
}

static uint32
align_wtf8_reverse(uint8 *bytes, uint32 pos, uint32 bytes_length)
{
    bh_assert(pos < bytes_length);

    if (is_wtf8_codepoint_start(bytes, pos)) {
        return pos;
    }

    if (is_wtf8_codepoint_start(bytes, pos - 1)) {
        return pos - 1;
    }

    if (is_wtf8_codepoint_start(bytes, pos - 2)) {
        return pos - 2;
    }

    return pos - 3;
}

static void
decode_codepoints_to_8bit_bytes(uint32 *code_points, uint32 code_points_length,
                                uint8 *target_bytes, int32 *target_bytes_length)
{
    int32 target_bytes_count = 0;
    uint32 i, code_point;

    for (i = 0; i < code_points_length; i++) {
        code_point = code_points[i];
        if (is_high_surrogate(code_point)) {
            /* If is a high surrogate code point, and next is a low surrogate
             * code point, reset value */
            if (i < code_points_length - 1
                && is_low_surrogate(code_points[i + 1])) {
                code_point = 0x10000 + ((code_point - 0xD800) << 10)
                             + (code_points[i + 1] - 0xDC00);
                i++;
            }
            else {
                if (target_bytes_length) {
                    *target_bytes_length = -1;
                }
                return;
            }
        }

        if (code_point <= 0x007F) {
            /* U+0000 to U+007F */
            if (target_bytes) {
                target_bytes[target_bytes_count++] = code_point & 0x7F;
            }
            else {
                target_bytes_count += 1;
            }
        }
        else if (0x0080 <= code_point && code_point <= 0x07FF) {
            /* U+0080 to U+07FF */
            if (target_bytes) {
                target_bytes[target_bytes_count++] = 0xC0 | (code_point >> 6);
                target_bytes[target_bytes_count++] = 0x80 | (code_point & 0x3F);
            }
            else {
                target_bytes_count += 2;
            }
        }
        else if (0x0800 <= code_point && code_point <= 0xFFFF) {
            /* U+0800 to U+FFFF */
            if (target_bytes) {
                target_bytes[target_bytes_count++] = 0xE0 | (code_point >> 12);
                target_bytes[target_bytes_count++] =
                    0x80 | ((code_point >> 6) & 0x3F);
                target_bytes[target_bytes_count++] = 0x80 | (code_point & 0x3F);
            }
            else {
                target_bytes_count += 3;
            }
        }
        else if (0x10000 <= code_point && code_point <= 0x10FFFF) {
            /* U+10000 to U+10FFFF */
            if (target_bytes) {
                target_bytes[target_bytes_count++] = 0xF0 | (code_point >> 18);
                target_bytes[target_bytes_count++] =
                    0x80 | ((code_point >> 12) & 0x3F);
                target_bytes[target_bytes_count++] =
                    0x80 | ((code_point >> 6) & 0x3F);
                target_bytes[target_bytes_count++] = 0x80 | (code_point & 0x3F);
            }
            else {
                target_bytes_count += 4;
            }
        }
    }

    if (target_bytes_length) {
        *target_bytes_length = target_bytes_count;
    }
}

static void
decode_codepoints_to_16bit_bytes(uint32 *code_points, uint32 code_points_length,
                                 uint16 *target_bytes,
                                 int32 *target_bytes_length)
{
    int32 target_bytes_count = 0;
    uint32 i, code_point;

    for (i = 0; i < code_points_length; i++) {
        code_point = code_points[i];
        if (is_supplementary_code_point(code_point)) {
            if (target_bytes) {
                target_bytes[target_bytes_count++] =
                    ((code_point - 0x10000) >> 10) + 0xD800;
                target_bytes[target_bytes_count++] =
                    ((code_point - 0x10000) & 0x3FF) + 0xDC00;
            }
            else {
                target_bytes_count += 2;
            }
        }
        else if (is_BMP_code_point(code_point)) {
            if (target_bytes) {
                target_bytes[target_bytes_count++] = (uint16)code_point;
            }
            else {
                target_bytes_count += 1;
            }
        }
    }

    if (target_bytes_length) {
        *target_bytes_length = target_bytes_count;
    }
}

static uint32
decode_8bit_bytes_to_one_codepoint(uint8 *bytes, uint32 pos,
                                   uint32 bytes_length, uint32 *code_point)
{
    uint8 byte, byte2, byte3, byte4;
    uint32 target_bytes_count = 0;

    byte = bytes[pos++];
    if (byte <= 0x7F) {
        if (code_point) {
            *code_point = byte;
        }
        target_bytes_count = 1;
    }
    else if (byte >= 0xC2 && byte <= 0xDF && pos < bytes_length) {
        byte2 = bytes[pos++];
        if (code_point) {
            *code_point = ((byte & 0x1F) << 6) + (byte2 & 0x3F);
        }
        target_bytes_count = 2;
    }
    else if (byte >= 0xE0 && byte <= 0xEF && pos + 1 < bytes_length) {
        byte2 = bytes[pos++];
        byte3 = bytes[pos++];
        if (code_point) {
            *code_point =
                ((byte & 0x0F) << 12) + ((byte2 & 0x3F) << 6) + (byte3 & 0x3F);
        }
        target_bytes_count = 3;
    }
    else if (byte >= 0xF0 && byte <= 0xF4 && pos + 2 < bytes_length) {
        byte2 = bytes[pos++];
        byte3 = bytes[pos++];
        byte4 = bytes[pos++];
        if (code_point) {
            *code_point = ((byte & 0x07) << 18) + ((byte2 & 0x3F) << 12)
                          + ((byte3 & 0x3F) << 6) + (byte4 & 0x3F);
        }
        target_bytes_count = 4;
    }

    return target_bytes_count;
}

static void
decode_8bit_bytes(uint8 *bytes, int32 bytes_length, uint32 *code_points,
                  int32 *code_points_length, uint8 *target_bytes,
                  int32 *target_bytes_length, EncodingFlag flag)
{
    int32 i = 0, j = 0, k = 0;
    int32 total_target_bytes_count = 0, target_bytes_count = 0;
    uint32 code_point = 0;

    while (i < bytes_length) {
        target_bytes_count = decode_8bit_bytes_to_one_codepoint(
            bytes, i, bytes_length, &code_point);
        i += target_bytes_count;
        if (is_isolated_surrogate(code_point)) {
            if (flag == UTF8) {
                if (target_bytes_length) {
                    *target_bytes_length = -1;
                }
                return;
            }
            else if (flag == WTF8) {
                if (target_bytes) {
                    for (k = 0; k < target_bytes_count; k++) {
                        *(target_bytes + k + total_target_bytes_count) =
                            *(bytes + i - target_bytes_count + k);
                    }
                }
                total_target_bytes_count += target_bytes_count;
            }
            else if (flag == LOSSY_UTF8) {
                code_point = 0xFFFD;
                if (target_bytes) {
                    *(target_bytes + total_target_bytes_count) =
                        0xE0 | (code_point >> 12);
                    *(target_bytes + total_target_bytes_count + 1) =
                        0x80 | ((code_point >> 6) & 0x3F);
                    *(target_bytes + total_target_bytes_count + 2) =
                        0x80 | (code_point & 0x3F);
                }
                total_target_bytes_count += 3;
            }
        }
        else {
            if (target_bytes) {
                for (k = 0; k < target_bytes_count; k++) {
                    *(target_bytes + k + total_target_bytes_count) =
                        *(bytes + i - target_bytes_count + k);
                }
            }
            total_target_bytes_count += target_bytes_count;
        }

        if (code_points) {
            code_points[j] = code_point;
        }
        j++;
    }

    if (code_points_length) {
        *code_points_length = j;
    }

    if (target_bytes_length) {
        *target_bytes_length = total_target_bytes_count;
    }
}

static int32
decode_16bit_bytes_to_one_codepoint(uint16 *bytes, uint32 pos,
                                    uint32 bytes_length, uint32 *code_point)
{
    uint16 byte, byte2;
    int32 target_bytes_count = 0;

    byte = bytes[pos++];
    if (is_high_surrogate(byte) && pos < bytes_length) {
        byte2 = bytes[pos++];
        if (is_low_surrogate(byte)) {
            if (*code_point) {
                *code_point =
                    0x10000 + ((byte - 0xD800) << 10) + (byte2 - 0xDC00);
            }
            target_bytes_count = 2;
        }
        else {
            target_bytes_count = -1;
        }
    }
    else {
        if (code_point) {
            *code_point = byte;
        }
        target_bytes_count = 1;
    }

    return target_bytes_count;
}

static void
decode_16bit_bytes(uint16 *bytes, int32 bytes_length, uint32 *code_points,
                   int32 *code_points_length)
{
    int32 i = 0, j = 0, target_bytes_count = 0;
    uint32 code_point = 0;

    while (i < bytes_length) {
        target_bytes_count = decode_16bit_bytes_to_one_codepoint(
            bytes, i, bytes_length, &code_point);
        i += target_bytes_count;
        if (code_points) {
            code_points[j] = code_point;
        }
        j++;
    }
    if (code_points_length) {
        *code_points_length = j;
    }
}

static int32
calculate_encoded_8bit_bytes_length_by_codepoints(uint32 *code_points,
                                                  uint32 code_points_length)
{
    int32 target_bytes_length;

    decode_codepoints_to_8bit_bytes(code_points, code_points_length, NULL,
                                    &target_bytes_length);

    return target_bytes_length;
}

static uint8 *
encode_8bit_bytes_by_codepoints(uint32 *code_points, uint32 code_points_length,
                                int32 *target_bytes_length)
{
    uint8 *target_bytes;

    *target_bytes_length = calculate_encoded_8bit_bytes_length_by_codepoints(
        code_points, code_points_length);

    if (*target_bytes_length > 0) {
        if (!(target_bytes = wasm_runtime_malloc(sizeof(uint8)
                                                 * (*target_bytes_length)))) {
            return NULL;
        }
        /* get target bytes */
        decode_codepoints_to_8bit_bytes(code_points, code_points_length,
                                        target_bytes, NULL);
    }
    else {
        target_bytes = NULL;
    }

    return target_bytes;
}

static int32
calculate_encoded_16bit_bytes_length_by_codepoints(uint32 *code_points,
                                                   uint32 code_points_length)
{
    int32 target_bytes_length;

    decode_codepoints_to_16bit_bytes(code_points, code_points_length, NULL,
                                     &target_bytes_length);

    return target_bytes_length;
}

static uint32 *
encode_codepoints_by_8bit_bytes_with_flag(uint8 *bytes, int32 bytes_length,
                                          int32 *code_points_length,
                                          EncodingFlag flag)
{
    uint32 *code_points;

    /* get code points length */
    decode_8bit_bytes(bytes, bytes_length, NULL, code_points_length, NULL, NULL,
                      flag);

    if (*code_points_length > 0) {
        if (!(code_points = wasm_runtime_malloc(sizeof(uint32)
                                                * (*code_points_length)))) {
            return NULL;
        }
        /* get code points */
        decode_8bit_bytes(bytes, bytes_length, code_points, NULL, NULL, NULL,
                          flag);
    }
    else {
        code_points = NULL;
    }
    return code_points;
}

static uint16 *
encode_16bit_bytes_by_8bit_bytes(uint8 *bytes, int32 bytes_length,
                                 int32 *target_code_units)
{
    uint16 *target_bytes;
    uint32 *code_points;
    int32 code_points_length;

    code_points = encode_codepoints_by_8bit_bytes_with_flag(
        bytes, bytes_length, &code_points_length, WTF8);
    *target_code_units = calculate_encoded_16bit_bytes_length_by_codepoints(
        code_points, code_points_length);

    if (*target_code_units > 0) {
        if (!(target_bytes =
                  wasm_runtime_malloc(sizeof(uint16) * (*target_code_units)))) {
            return NULL;
        }
        /* get target bytes */
        decode_codepoints_to_16bit_bytes(code_points, code_points_length,
                                         target_bytes, NULL);
    }
    else {
        target_bytes = NULL;
    }
    if (code_points) {
        wasm_runtime_free(code_points);
    }

    return target_bytes;
}

static int32
calculate_encoded_8bit_bytes_length_by_8bit_bytes_with_flag(uint8 *bytes,
                                                            int32 bytes_length,
                                                            EncodingFlag flag)
{
    int32 target_bytes_length;

    decode_8bit_bytes(bytes, bytes_length, NULL, NULL, NULL,
                      &target_bytes_length, flag);

    return target_bytes_length;
}

static uint8 *
encode_8bit_bytes_by_8bit_bytes_with_flag(uint8 *bytes, int32 bytes_length,
                                          int32 *target_bytes_length,
                                          EncodingFlag flag)
{
    uint8 *target_bytes;

    /* get target bytes length */
    *target_bytes_length =
        calculate_encoded_8bit_bytes_length_by_8bit_bytes_with_flag(
            bytes, bytes_length, flag);

    if (*target_bytes_length > 0) {
        if (!(target_bytes = wasm_runtime_malloc(sizeof(uint8)
                                                 * (*target_bytes_length)))) {
            return NULL;
        }
        /* get target bytes */
        decode_8bit_bytes(bytes, bytes_length, NULL, NULL, target_bytes, NULL,
                          flag);
    }
    else {
        target_bytes = NULL;
    }

    return target_bytes;
}

static uint32 *
encode_codepoints_by_16bit_bytes(uint16 *bytes, int32 bytes_length,
                                 int32 *code_points_length)
{
    uint32 *code_points;

    /* get code points length */
    decode_16bit_bytes(bytes, bytes_length, NULL, code_points_length);

    if (*code_points_length > 0) {
        if (!(code_points = wasm_runtime_malloc(sizeof(uint32)
                                                * (*code_points_length)))) {
            return NULL;
        }
        /* get code points */
        decode_16bit_bytes(bytes, bytes_length, code_points, NULL);
    }
    else {
        code_points = NULL;
    }
    return code_points;
}

static int32
calculate_encoded_code_units_by_8bit_bytes_with_flag(uint8 *bytes,
                                                     int32 bytes_length,
                                                     EncodingFlag flag)
{
    int32 target_bytes_length, code_points_length;
    uint32 *code_points;

    if (flag == WTF16) {
        code_points = encode_codepoints_by_8bit_bytes_with_flag(
            bytes, bytes_length, &code_points_length, WTF8);
        target_bytes_length =
            calculate_encoded_16bit_bytes_length_by_codepoints(
                code_points, code_points_length);
        if (code_points) {
            wasm_runtime_free(code_points);
        }
    }
    else {
        target_bytes_length =
            calculate_encoded_8bit_bytes_length_by_8bit_bytes_with_flag(
                bytes, bytes_length, flag);
    }

    return target_bytes_length;
}

static void *
encode_target_bytes_by_8bit_bytes_with_flag(uint8 *bytes, int32 bytes_length,
                                            int32 *target_bytes_length,
                                            EncodingFlag flag)
{
    void *target_bytes;
    if (flag == WTF16) {
        target_bytes = encode_16bit_bytes_by_8bit_bytes(bytes, bytes_length,
                                                        target_bytes_length);
    }
    else {
        target_bytes = encode_8bit_bytes_by_8bit_bytes_with_flag(
            bytes, bytes_length, target_bytes_length, flag);
    }
    return target_bytes;
}

static uint8 *
concat_8bit_bytes(uint8 *bytes1, int32 bytes_length1, uint8 *bytes2,
                  int32 bytes_length2, int32 *bytes_length_total,
                  EncodingFlag flag)
{
    uint32 *code_points1 = NULL, *code_points2 = NULL,
           *code_points_total = NULL;
    int32 code_points_length1 = 0, code_points_length2 = 0,
          code_points_total_length = 0;
    uint8 *target_bytes = NULL;

    code_points1 = encode_codepoints_by_8bit_bytes_with_flag(
        bytes1, bytes_length1, &code_points_length1, flag);
    code_points2 = encode_codepoints_by_8bit_bytes_with_flag(
        bytes2, bytes_length2, &code_points_length2, flag);
    code_points_total_length = code_points_length1 + code_points_length2;
    if (code_points_total_length > 0) {
        code_points_total =
            wasm_runtime_malloc(sizeof(uint32) * code_points_total_length);
        bh_memcpy_s(code_points_total, sizeof(uint32) * code_points_length1,
                    code_points1, sizeof(uint32) * code_points_length1);
        bh_memcpy_s(code_points_total + code_points_length1,
                    sizeof(uint32) * code_points_length2, code_points2,
                    sizeof(uint32) * code_points_length2);
    }
    target_bytes = encode_8bit_bytes_by_codepoints(
        code_points_total, code_points_total_length, bytes_length_total);
    if (code_points1) {
        wasm_runtime_free(code_points1);
    }
    if (code_points2) {
        wasm_runtime_free(code_points2);
    }
    if (code_points_total) {
        wasm_runtime_free(code_points_total);
    }
    return target_bytes;
}

static uint32
wtf16_pos_treatment(uint32 pos, uint32 code_units_length)
{
    uint32 ret_pos;

    ret_pos = pos;
    if (pos > code_units_length) {
        ret_pos = code_units_length;
    }

    return ret_pos;
}

static uint32
wtf8_string_bytes_advance(uint8 *string_bytes, int32 string_bytes_length,
                          uint32 pos, uint32 bytes)
{
    uint32 start_pos, next_pos;

    start_pos = align_wtf8_sequential(string_bytes, pos, string_bytes_length);
    if (bytes == 0) {
        next_pos = start_pos;
    }
    else if (bytes >= string_bytes_length - start_pos) {
        next_pos = string_bytes_length;
    }
    else {
        next_pos = align_wtf8_reverse(string_bytes, start_pos + bytes,
                                      string_bytes_length);
    }

    return next_pos;
}

static int32
wtf8_string_bytes_iter_next(uint8 *string_bytes, int32 string_bytes_length,
                            int32 cur_pos, uint32 *code_point)
{
    uint32 target_bytes_count;

    if (cur_pos >= string_bytes_length) {
        return -1;
    }

    target_bytes_count = decode_8bit_bytes_to_one_codepoint(
        string_bytes, cur_pos, string_bytes_length, code_point);
    cur_pos += target_bytes_count;

    return cur_pos;
}

static int32
wtf8_string_bytes_iter_advance(uint8 *string_bytes, int32 string_bytes_length,
                               int32 cur_pos, uint32 code_points_count,
                               uint32 *code_points_consumed)
{
    uint32 advance_count = 0, target_bytes_count, advance_pos;

    while (advance_count < code_points_count) {
        if (cur_pos == string_bytes_length) {
            break;
        }
        advance_count++;
        advance_pos = align_wtf8_sequential(string_bytes, cur_pos + 1,
                                            string_bytes_length);
        target_bytes_count = advance_pos - cur_pos;
        cur_pos += target_bytes_count;
    }

    if (code_points_consumed) {
        *code_points_consumed = advance_count;
    }

    return cur_pos;
}

static int32
wtf8_string_bytes_iter_rewind(uint8 *string_bytes, int32 string_bytes_length,
                              int32 cur_pos, uint32 code_points_count,
                              uint32 *code_points_consumed)
{
    uint32 rewind_count = 0, target_bytes_count, rewind_pos;

    while (rewind_count < code_points_count) {
        if (cur_pos == 0) {
            break;
        }
        rewind_count++;
        rewind_pos =
            align_wtf8_reverse(string_bytes, cur_pos - 1, string_bytes_length);
        target_bytes_count = cur_pos - rewind_pos;
        cur_pos -= target_bytes_count;
    }

    if (code_points_consumed) {
        *code_points_consumed = rewind_count;
    }

    return cur_pos;
}

static int32
wtf8_string_bytes_iter_slice(uint8 *string_bytes, int32 string_bytes_length,
                             int32 cur_pos, int32 code_points_count)
{
    int32 end_pos, advance_count, target_bytes_count, advance_pos;

    advance_count = 0;
    end_pos = cur_pos;
    while (advance_count < code_points_count) {
        if (end_pos == string_bytes_length) {
            break;
        }
        advance_count++;

        advance_pos = align_wtf8_sequential(string_bytes, end_pos + 1,
                                            string_bytes_length);
        target_bytes_count = advance_pos - end_pos;
        end_pos += target_bytes_count;
    }

    return end_pos;
}

/******************* gc finalizer *****************/
void
wasm_stringref_obj_finalizer(WASMStringrefObjectRef stringref_obj, void *data)
{
    WASMStringImpl *string_obj = (WASMStringImpl *)stringref_obj->str_obj;

    if (string_obj) {
        string_obj->ref_count--;
    }
    if (string_obj && string_obj->ref_count == 0) {
        if (!(string_obj->is_const)) {
            if (string_obj->u.bytes) {
                wasm_runtime_free(string_obj->u.bytes);
            }
        }
        wasm_runtime_free(string_obj);
    }
}

void
wasm_stringview_wtf8_obj_finalizer(
    WASMStringviewWTF8ObjectRef stringview_wtf8_obj, void *data)
{
    WASMStringImpl *string_obj = (WASMStringImpl *)stringview_wtf8_obj->str_obj;

    if (string_obj) {
        string_obj->ref_count--;
    }
    if (string_obj && string_obj->ref_count == 0) {
        if (!(string_obj->is_const)) {
            if (string_obj->u.bytes) {
                wasm_runtime_free(string_obj->u.bytes);
            }
        }
        wasm_runtime_free(string_obj);
    }
}

void
wasm_stringview_wtf16_obj_finalizer(
    WASMStringviewWTF16ObjectRef stringview_wtf16_obj, void *data)
{
    WASMStringImpl *string_obj =
        (WASMStringImpl *)stringview_wtf16_obj->str_obj;

    if (string_obj) {
        string_obj->ref_count--;
    }
    if (string_obj && string_obj->ref_count == 0) {
        if (!(string_obj->is_const)) {
            if (string_obj->u.code_units) {
                wasm_runtime_free(string_obj->u.code_units);
            }
        }
        wasm_runtime_free(string_obj);
    }
}

void
wasm_stringview_iter_obj_finalizer(
    WASMStringviewIterObjectRef stringview_iter_obj, void *data)
{
    WASMStringImpl *string_obj = (WASMStringImpl *)stringview_iter_obj->str_obj;

    if (string_obj) {
        string_obj->ref_count--;
    }
    if (string_obj && string_obj->ref_count == 0) {
        if (!(string_obj->is_const)) {
            if (string_obj->u.bytes) {
                wasm_runtime_free(string_obj->u.bytes);
            }
        }
        wasm_runtime_free(string_obj);
    }
}

/******************* functional functions *****************/

static int32
wasm_string_get_length(WASMString str_obj)
{
    WASMStringImpl *string_obj = str_obj;
    int32 length = 0;

    if (string_obj) {
        length = string_obj->length;
    }

    return length;
}

static uint8 *
wasm_string_get_bytes(WASMString str_obj)
{
    WASMStringImpl *string_obj = str_obj;
    uint8 *string_bytes = NULL;

    if (string_obj) {
        string_bytes = string_obj->u.bytes;
    }

    return string_bytes;
}

static uint16 *
wasm_string_get_codeunits(WASMString str_obj)
{
    WASMStringImpl *string_obj = str_obj;
    uint16 *code_units = NULL;

    if (string_obj) {
        code_units = string_obj->u.code_units;
    }

    return code_units;
}

static int32
wasm_string_measure_from_start(WASMString str_obj, EncodingFlag flag,
                               uint32 start)
{
    int32 string_bytes_length, target_bytes_length;
    uint8 *string_bytes;

    bh_assert(((WASMStringImpl *)str_obj)->source_flag == Bit8);
    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);
    target_bytes_length = calculate_encoded_code_units_by_8bit_bytes_with_flag(
        string_bytes + start, string_bytes_length - start, flag);

    return target_bytes_length;
}

static void *
wasm_string_encode_with_flag(WASMString str_obj, EncodingFlag flag)
{
    int32 string_bytes_length, target_bytes_length;
    uint8 *string_bytes;
    void *target_bytes = NULL;

    bh_assert(((WASMStringImpl *)str_obj)->source_flag == Bit8);
    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);

    target_bytes = encode_target_bytes_by_8bit_bytes_with_flag(
        string_bytes, string_bytes_length, &target_bytes_length, flag);

    return target_bytes;
}

static WASMString
wasm_string_wtf8_obj_new(uint8 *bytes, uint32 length)
{
    WASMStringImpl *string_obj;

    if (!(string_obj = wasm_runtime_malloc(sizeof(WASMStringImpl)))) {
        return NULL;
    }
    if (length > 0 && !bytes) {
        wasm_runtime_free(string_obj);
        return NULL;
    }

    string_obj->u.bytes = bytes;
    string_obj->source_flag = Bit8;
    string_obj->length = length;
    string_obj->is_const = false;
    string_obj->ref_count = 1;

    return string_obj;
}

static WASMString
wasm_string_wtf16_obj_new(uint16 *target_bytes, uint32 length)
{
    WASMStringImpl *string_obj;

    if (!(string_obj = wasm_runtime_malloc(sizeof(WASMStringImpl)))) {
        return NULL;
    }

    if (!target_bytes) {
        wasm_runtime_free(string_obj);
        return NULL;
    }

    string_obj->u.code_units = target_bytes;
    string_obj->source_flag = Bit16;
    string_obj->length = length;
    string_obj->is_const = false;
    string_obj->ref_count = 1;

    return string_obj;
}

static WASMString
wasm_string_new_with_8bit_embedder(uint8 *bytes, uint32 bytes_length)
{
    return wasm_string_wtf8_obj_new(bytes, bytes_length);
}

static WASMString
wasm_string_new_with_16bit_embedder(uint16 *bytes, uint32 bytes_length)
{
    WASMStringImpl *str_obj;
    uint8 *string_bytes;
    uint32 *code_points;
    int32 code_point_length, target_bytes_length;

    code_points = encode_codepoints_by_16bit_bytes(bytes, bytes_length,
                                                   &code_point_length);
    string_bytes = encode_8bit_bytes_by_codepoints(
        code_points, code_point_length, &target_bytes_length);

    str_obj = wasm_string_wtf8_obj_new(string_bytes, target_bytes_length);
    if (!str_obj) {
        return NULL;
    }

    if (code_points) {
        wasm_runtime_free(code_points);
    }

    return str_obj;
}

/******************* opcode functions *****************/

/* string.const */
WASMString
wasm_string_new_const(const char *str)
{
    WASMStringImpl *string_obj;
    uint32_t string_length = 0;

    if (!(string_obj = wasm_runtime_malloc(sizeof(WASMStringImpl)))) {
        return false;
    }

    string_obj->length = string_length = strlen(str);
    string_obj->is_const = true;
    string_obj->ref_count = 1;
    string_obj->source_flag = Bit8;

    if (string_length > 0) {
        string_obj->u.bytes = (uint8 *)str;
    }

    return string_obj;
}

/* string.new_xx8 */
/* string.new_wtf16 */
/* string.new_xx8_array */
/* string.new_wtf16_array */
WASMString
wasm_string_new_with_encoding(void *addr, uint32 count, EncodingFlag flag)
{
    uint8 *target_bytes;
    int32 target_bytes_length;
    WASMString string_obj;

    if (flag == WTF8 || flag == UTF8 || flag == LOSSY_UTF8) {
        target_bytes = encode_8bit_bytes_by_8bit_bytes_with_flag(
            addr, count, &target_bytes_length, flag);
        if (target_bytes_length == -1) {
            if (target_bytes) {
                wasm_runtime_free(target_bytes);
            }
            return NULL;
        }
        string_obj = wasm_string_new_with_8bit_embedder(target_bytes,
                                                        target_bytes_length);
    }
    else {
        /* WTF16 */
        uint16 *target_code_units;
        uint32 i;

        if (!(target_code_units =
                  wasm_runtime_malloc(sizeof(uint16) * count))) {
            return NULL;
        }

        for (i = 0; i < count; i++) {
            target_code_units[i] = *(int16 *)(addr + (i * 2));
        }

        string_obj =
            wasm_string_new_with_16bit_embedder(target_code_units, count);

        wasm_runtime_free(target_code_units);
    }

    return string_obj;
}

/* string.measure */
int32
wasm_string_measure(WASMString str_obj, EncodingFlag flag)
{
    return wasm_string_measure_from_start(str_obj, flag, 0);
}

/* stringview_wtf16.length */
int32
wasm_string_wtf16_get_length(WASMString str_obj)
{
    return wasm_string_get_length(str_obj);
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
    WASMStringImpl *string_obj = str_obj;
    int32 target_bytes_length, string_bytes_length, i;
    uint8 *target_bytes, *string_bytes;
    uint16 *target_code_units;
    uint32 written_codes, start_pos, view_bytes_length;

    if (string_obj->source_flag == Bit8) {
        /* string.encode_xx8 */
        /* string.encode_xx8_array */
        if (next_pos == NULL) {
            target_bytes_length =
                wasm_string_measure_from_start(str_obj, flag, pos);
            /* string.encode_xxx_array should judge if array have enough space
             * to store bytes */
            if ((uint32)target_bytes_length > count) {
                return Insufficient_Space;
            }
            if (flag == UTF8 || flag == WTF8 || flag == LOSSY_UTF8) {
                target_bytes =
                    (uint8 *)wasm_string_encode_with_flag(str_obj, flag);
                if (!target_bytes) {
                    return Encode_Fail;
                }
                if (target_bytes_length == -1) {
                    return Isolated_Surrogate;
                }
                bh_memcpy_s(addr, target_bytes_length, target_bytes,
                            target_bytes_length);
                if (target_bytes) {
                    wasm_runtime_free(target_bytes);
                }
            }
            /* string.encode_wtf16 */
            /* string.encode_wtf16_array */
            else {
                target_code_units =
                    (uint16 *)wasm_string_encode_with_flag(str_obj, flag);
                if (!target_code_units) {
                    return -1;
                }
                for (i = 0; i < target_bytes_length; i++) {
                    *(uint16 *)(addr + (i * 2)) =
                        (uint16)(target_code_units[i]);
                }
                if (target_code_units) {
                    wasm_runtime_free(target_code_units);
                }
            }
            written_codes = target_bytes_length;
        }
        /* stringview_wtf8.encode_xx */
        else {
            string_bytes_length = wasm_string_get_length(str_obj);
            string_bytes = wasm_string_get_bytes(str_obj);
            start_pos = wtf8_string_bytes_advance(string_bytes,
                                                  string_bytes_length, pos, 0);
            *next_pos = wtf8_string_bytes_advance(
                string_bytes, string_bytes_length, start_pos, count);
            view_bytes_length = *next_pos - start_pos;

            target_bytes = encode_8bit_bytes_by_8bit_bytes_with_flag(
                string_bytes + start_pos, view_bytes_length,
                &target_bytes_length, flag);
            if (target_bytes_length == -1) {
                return Isolated_Surrogate;
            }
            bh_memcpy_s(addr, target_bytes_length, target_bytes,
                        target_bytes_length);

            written_codes = target_bytes_length;
        }
    }
    /* stringview_wtf16.encode */
    else {
        bh_assert(flag == WTF16);
        written_codes = 0;
        string_bytes_length = wasm_string_get_length(str_obj);
        target_code_units = wasm_string_get_codeunits(str_obj);
        start_pos = wtf16_pos_treatment(pos, string_bytes_length);
        for (i = 0; i < (int32)count; i++) {
            *(uint16 *)(addr + (i * 2)) =
                (uint16)(target_code_units[i + start_pos]);
            written_codes++;
        }
    }
    return written_codes;
}

/* string.concat */
WASMString
wasm_string_concat(WASMString str_obj1, WASMString str_obj2)
{
    uint8 *string_bytes1, *string_bytes2, *target_bytes = NULL;
    int32 string_bytes_length1, string_bytes_length2, target_bytes_length;
    EncodingFlag flag = WTF8;
    WASMString str_obj;

    string_bytes1 = wasm_string_get_bytes(str_obj1);
    string_bytes_length1 = wasm_string_get_length(str_obj1);
    string_bytes2 = wasm_string_get_bytes(str_obj2);
    string_bytes_length2 = wasm_string_get_length(str_obj2);
    target_bytes =
        concat_8bit_bytes(string_bytes1, string_bytes_length1, string_bytes2,
                          string_bytes_length2, &target_bytes_length, flag);
    str_obj =
        wasm_string_new_with_8bit_embedder(target_bytes, target_bytes_length);

    return str_obj;
}

/* string.eq */
int32
wasm_string_eq(WASMString str_obj1, WASMString str_obj2)
{
    WASMStringImpl *string_obj1, *string_obj2;
    int32_t string_length1, string_length2, i;
    uint8_t *string_bytes1, *string_bytes2;

    string_obj1 = (WASMStringImpl *)str_obj1;
    string_obj2 = (WASMStringImpl *)str_obj2;

    if (string_obj1 == string_obj2) {
        return 1;
    }

    if (string_obj1 == NULL || string_obj2 == NULL) {
        return 0;
    }

    string_length1 = string_obj1->length;
    string_length2 = string_obj2->length;
    string_bytes1 = string_obj1->u.bytes;
    string_bytes2 = string_obj2->u.bytes;

    if (string_length1 != string_length2) {
        return 0;
    }

    for (i = 0; i < string_length1; i++) {
        if (string_bytes1[i] != string_bytes2[i]) {
            return 0;
        }
    }

    return 1;
}

/* string.is_usv_sequence */
int32
wasm_string_is_usv_sequence(WASMString str_obj)
{
    int32 target_bytes_length, is_usv_sequence, string_bytes_length;
    uint8 *string_bytes;
    EncodingFlag flag = WTF8;

    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);
    target_bytes_length = calculate_encoded_code_units_by_8bit_bytes_with_flag(
        string_bytes, string_bytes_length, flag);
    if (target_bytes_length == -1) {
        is_usv_sequence = 0;
    }
    else {
        is_usv_sequence = 1;
    }

    return is_usv_sequence;
}

/* string.as_wtf8 */
/* string.as_wtf16 */
/* string.as_iter */
WASMString
wasm_string_create_view(WASMString str_obj, StringViewType type)
{
    if (type == STRING_VIEW_WTF8 || type == STRING_VIEW_ITER) {
        WASMStringImpl *string_obj = str_obj;
        string_obj->ref_count++;
        return string_obj;
    }
    else {
        uint8 *target_bytes;
        uint16 *target_code_units;
        int32 target_bytes_length, target_code_units_length;
        WASMStringImpl *string_obj;

        target_bytes = wasm_string_get_bytes(str_obj);
        target_bytes_length = wasm_string_get_length(str_obj);
        target_code_units =
            (uint16 *)encode_target_bytes_by_8bit_bytes_with_flag(
                target_bytes, target_bytes_length, &target_code_units_length,
                WTF16);
        string_obj = wasm_string_wtf16_obj_new(target_code_units,
                                               target_code_units_length);

        return string_obj;
    }
}

/* stringview_wtf8.advance */
/* stringview_iter.advance */
int32
wasm_string_advance(WASMString str_obj, uint32 pos, uint32 count,
                    uint32 *consumed)
{
    uint8 *string_bytes;
    int32 string_bytes_length;
    uint32 next_pos;

    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);

    if (consumed) {
        next_pos = wtf8_string_bytes_iter_advance(
            string_bytes, string_bytes_length, pos, count, consumed);
    }
    else {
        next_pos = wtf8_string_bytes_advance(string_bytes, string_bytes_length,
                                             pos, count);
    }

    return next_pos;
}

/* stringview_wtf8.slice */
/* stringview_wtf16.slice */
/* stringview_iter.slice */
WASMString
wasm_string_slice(WASMString str_obj, uint32 start, uint32 end,
                  StringViewType type)
{
    WASMString res_str_obj = NULL;

    if (type == STRING_VIEW_WTF8) {
        uint8 *string_bytes, *target_bytes;
        int32 string_bytes_length, target_bytes_length;
        uint32 start_pos, end_pos;

        string_bytes = wasm_string_get_bytes(str_obj);
        string_bytes_length = wasm_string_get_length(str_obj);

        start_pos = wtf8_string_bytes_advance(string_bytes, string_bytes_length,
                                              start, 0);
        end_pos = wtf8_string_bytes_advance(string_bytes, string_bytes_length,
                                            end, 0);

        target_bytes_length = end_pos - start_pos;

        if (!(target_bytes =
                  wasm_runtime_malloc(sizeof(uint8) * target_bytes_length))) {
            return NULL;
        }
        bh_memcpy_s(target_bytes, target_bytes_length, string_bytes + start_pos,
                    target_bytes_length);

        res_str_obj = wasm_string_new_with_8bit_embedder(target_bytes,
                                                         target_bytes_length);
    }
    else if (type == STRING_VIEW_WTF16) {
        uint16 *target_code_units;
        int32 code_units_length;
        uint32 start_pos, end_pos;

        code_units_length = wasm_string_get_length(str_obj);
        target_code_units = wasm_string_get_codeunits(str_obj);

        start_pos = wtf16_pos_treatment(start, code_units_length);
        end_pos = wtf16_pos_treatment(end, code_units_length);
        res_str_obj = wasm_string_new_with_16bit_embedder(
            target_code_units + start_pos, end_pos - start_pos);
    }
    else if (type == STRING_VIEW_ITER) {
        uint8 *string_bytes, *target_bytes;
        int32 string_bytes_length, end_pos, target_bytes_length;
        int32 code_points_count = end - start;

        string_bytes = wasm_string_get_bytes(str_obj);
        string_bytes_length = wasm_string_get_length(str_obj);

        end_pos = wtf8_string_bytes_iter_slice(
            string_bytes, string_bytes_length, start, code_points_count);

        target_bytes_length = end_pos - start;

        if (!(target_bytes =
                  wasm_runtime_malloc(sizeof(uint8) * target_bytes_length))) {
            return NULL;
        }
        bh_memcpy_s(target_bytes, target_bytes_length, string_bytes + start,
                    target_bytes_length);

        res_str_obj = wasm_string_new_with_8bit_embedder(target_bytes,
                                                         target_bytes_length);
    }

    return res_str_obj;
}

/* stringview_wtf16.get_codeunit */
int16
wasm_string_get_wtf16_codeunit(WASMString str_obj, int32 pos)
{
    int32 code_units_len;
    uint16 *code_units;
    int16 target_code_unit;

    code_units_len = wasm_string_get_length(str_obj);
    if (pos >= code_units_len) {
        return -1;
    }

    code_units = wasm_string_get_codeunits(str_obj);
    target_code_unit = (int16) * (code_units + pos);

    return target_code_unit;
}

/* stringview_iter.next */
uint32
wasm_string_next_codepoint(WASMString str_obj, uint32 pos)
{
    uint32 code_point;
    uint8 *string_bytes;
    int32 string_bytes_length, target_pos;

    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);
    target_pos = wtf8_string_bytes_iter_next(string_bytes, string_bytes_length,
                                             pos, &code_point);

    wasm_stringview_iter_obj_update_pos(str_obj, target_pos);

    return code_point;
}

/* stringview_iter.rewind */
uint32
wasm_string_rewind(WASMString str_obj, uint32 pos, uint32 count,
                   uint32 *consumed)
{
    uint8 *string_bytes;
    uint32 string_bytes_length, target_pos = 0;

    string_bytes = wasm_string_get_bytes(str_obj);
    string_bytes_length = wasm_string_get_length(str_obj);

    target_pos = wtf8_string_bytes_iter_rewind(
        string_bytes, string_bytes_length, pos, count, consumed);

    return target_pos;
}

/******************* application functions *****************/

void
wasm_string_dump(WASMString str_obj)
{
    int32 str_len, i, code_point_length;
    uint8 *string_bytes;
    uint16 *code_units;
    uint32 *code_points;

    str_len = wasm_string_get_length(str_obj);
    if (((WASMStringImpl *)str_obj)->source_flag == Bit16) {
        code_units = wasm_string_get_codeunits(str_obj);
        code_points = encode_codepoints_by_16bit_bytes(code_units, str_len,
                                                       &code_point_length);
        string_bytes = encode_8bit_bytes_by_codepoints(
            code_points, code_point_length, &str_len);
        if (code_points) {
            wasm_runtime_free(code_points);
        }
    }
    else {
        string_bytes = (uint8 *)wasm_string_encode_with_flag(str_obj, UTF8);
    }

    if (str_len != 0) {
        for (i = 0; i < str_len; i++) {
            os_printf("%c", string_bytes[i]);
        }
    }

    if (string_bytes) {
        wasm_runtime_free(string_bytes);
    }
}