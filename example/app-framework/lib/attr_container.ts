/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { i32, arraybuffer_to_string, string_to_arraybuffer } from './utils';

const ATTR_TYPE_BEGIN = 0,
    ATTR_TYPE_BYTE = 0,
    ATTR_TYPE_INT8 = 0,
    ATTR_TYPE_SHORT = 0,
    ATTR_TYPE_INT16 = 1,
    ATTR_TYPE_INT = 2,
    ATTR_TYPE_INT32 = 2,
    ATTR_TYPE_INT64 = 3,
    ATTR_TYPE_UINT8 = 4,
    ATTR_TYPE_UINT16 = 5,
    ATTR_TYPE_UINT32 = 6,
    ATTR_TYPE_UINT64 = 7,
    /**
     * Why ATTR_TYPE_FLOAT = 10?
     * We determine the number of bytes that should be copied through 1<<(type &
     * 3). ATTR_TYPE_BYTE = 0, so the number of bytes is 1 << 0  = 1.
     * ATTR_TYPE_UINT64 = 7, so the number of bytes is 1 << 3 = 8.
     * Since the float type takes up 4 bytes, ATTR_TYPE_FLOAT should be 10.
     * Calculation: (1 << (10&3)) = (1 << 2) = 4
     */
    ATTR_TYPE_FLOAT = 10,
    ATTR_TYPE_DOUBLE = 11,
    ATTR_TYPE_BOOLEAN = 12,
    ATTR_TYPE_STRING = 13,
    ATTR_TYPE_BYTEARRAY = 14,
    ATTR_TYPE_END = 14;

const ATTR_CONT_READONLY_SHIFT = 2;
export let global_attr_cont: ArrayBuffer;

export function attr_container_create(tag: string) {
    const tag_length = tag.length + 1;
    const offset_of_buf = 2;
    const length = offset_of_buf + 4 + 2 + tag_length + 100;

    const attr_buffer = new ArrayBuffer(length);
    const dataview = new DataView(attr_buffer);
    for (let i = 0; i < length; i++) {
        dataview.setUint8(i, 0);
    }
    let offset = offset_of_buf;
    dataview.setUint32(offset, length - offset_of_buf, true);
    offset += 4;
    dataview.setUint16(offset, tag_length, true);
    offset += 2;
    for (let i = 0; i < tag.length; i++) {
        dataview.setUint8(i + offset, tag.charCodeAt(i));
    }
    return attr_buffer;
}

export function attr_container_get_serialize_length(args: ArrayBuffer): i32 {
    const dataview = new DataView(args);
    const buf_value = dataview.getUint32(2, true);
    return 2 + buf_value;
}

export function attr_container_set_string(
    attr_cont: ArrayBuffer,
    key: string,
    value: string,
) {
    const value_buffer = string_to_arraybuffer(value);
    return attr_container_set_attr(
        attr_cont,
        key,
        ATTR_TYPE_STRING,
        value_buffer,
        value.length + 1,
    );
}

export function attr_container_set_uint16(
    attr_cont: ArrayBuffer,
    key: string,
    value: number,
) {
    const value_buffer = new ArrayBuffer(2);
    const value_dataview = new DataView(value_buffer);
    value_dataview.setUint16(0, value, true);
    return attr_container_set_attr(
        attr_cont,
        key,
        ATTR_TYPE_UINT16,
        value_buffer,
        2,
    );
}

function check_set_attr(p_attr_cont: ArrayBuffer, key: string) {
    if (key.length === 0) {
        console.log('Set attribute failed: invalid input arguments.');
        return false;
    }
    const dataview = new DataView(p_attr_cont);
    const flags = dataview.getUint32(0, true);
    if (flags & ATTR_CONT_READONLY_SHIFT) {
        console.log('Set attribute failed: attribute container is readonly.');
        return false;
    }
    return true;
}

export function attr_container_get_attr_begin(attr_cont: ArrayBuffer) {
    let p = 2;
    const dataview = new DataView(attr_cont);
    /* skip total length */
    const total_length = dataview.getUint32(p, true);
    p += 4;
    /* tag length */
    const str_len = dataview.getUint16(p, true);
    p += 2;
    /* tag content */
    p += str_len;
    /* attribute num */
    const attr_num = dataview.getUint16(p, true);
    p += 2;

    return p;
}

export function attr_container_get_attr_total_length(attr_cont: ArrayBuffer) {
    const p = 2;
    const dataview = new DataView(attr_cont);
    const total_length = dataview.getUint32(p, true);
    return total_length;
}

export function attr_container_get_attr_num(attr_cont: ArrayBuffer) {
    let p = 2;
    const dataview = new DataView(attr_cont);
    /* skip total length */
    const total_length = dataview.getUint32(p, true);
    p += 4;
    /* tag length */
    const str_len = dataview.getUint16(p, true);
    p += 2;
    /* tag content */
    p += str_len;
    /* attribute num */
    const attr_num = dataview.getUint16(p, true);
    p += 2;
    return attr_num;
}

export function attr_container_get_msg_end(attr_cont: ArrayBuffer) {
    const p = 2;
    const dataview = new DataView(attr_cont);
    return p + dataview.getUint32(p, true);
}

export function attr_container_get_attr_next(
    attr_cont: ArrayBuffer,
    curr_attr_pos: number,
) {
    let p = curr_attr_pos;
    const dataview = new DataView(attr_cont);
    /* key length and key */
    p += 2 + dataview.getUint16(p, true);
    const type = dataview.getUint8(p);
    p++;

    /* Byte type to Boolean type */
    if (type >= ATTR_TYPE_BYTE && type <= ATTR_TYPE_BOOLEAN) {
        p += 1 << (type & 3);
        return p;
    } else if (type == ATTR_TYPE_STRING) {
        /* String type */
        p += 2 + dataview.getUint16(p, true);
        return p;
    } else if (type == ATTR_TYPE_BYTEARRAY) {
        /* ByteArray type */
        p += 4 + dataview.getUint32(p, true);
        return p;
    }
}

export function attr_container_get_attr_end(attr_cont: ArrayBuffer) {
    let p = attr_container_get_attr_begin(attr_cont);
    const attr_num = attr_container_get_attr_num(attr_cont);
    for (let i = 0; i < attr_num; i++) {
        const tmp = attr_container_get_attr_next(attr_cont, p);
        if (tmp === undefined) {
            return -1;
        } else {
            p = tmp;
        }
    }
    return p;
}

export function attr_container_find_attr(attr_cont: ArrayBuffer, key: string) {
    let p = 2;
    p = attr_container_get_attr_begin(attr_cont);
    const attr_num = attr_container_get_attr_num(attr_cont);
    const dataview = new DataView(attr_cont);

    for (let i = 0; i < attr_num; i++) {
        const str_len = dataview.getUint16(p, true);
        if (str_len == key.length + 1) {
            for (let i = 0; i < key.length; i++) {
                dataview.setUint8(p + 2 + i, key.charCodeAt(i));
            }
            /* string length also includes /0 in C */
            dataview.setUint8(p + str_len - 1, 0);
            return p;
        }
        const tmp = attr_container_get_attr_next(attr_cont, p);
        if (tmp === undefined) {
            return -1;
        } else {
            p = tmp;
        }
    }
    return -1;
}

function attr_container_inc_attr_num(attr_cont: ArrayBuffer) {
    /* skip total length */
    let p = 2 + 4;
    const dataview = new DataView(attr_cont);

    const str_len = dataview.getUint16(p, true);
    /* skip tag length and tag */
    p += 2 + str_len;

    /* attribute num */
    const attr_num = dataview.getUint16(p, true) + 1;
    dataview.setUint16(p, attr_num, true);
}

export function attr_container_set_attr(
    attr_cont: ArrayBuffer,
    key: string,
    type: number,
    value: ArrayBuffer,
    value_length: number,
) {
    if (!check_set_attr(attr_cont, key)) {
        return false;
    }
    let p = 2;
    const dataview = new DataView(attr_cont);
    const value_dataview = new DataView(value);
    let total_length = dataview.getUint32(p, true);

    const attr_end = attr_container_get_attr_end(attr_cont);
    if (attr_end === -1) {
        console.log('Set attr failed: get attr end failed.');
        return false;
    }

    const msg_end = attr_container_get_msg_end(attr_cont);

    /* key len + key + '\0' + type */
    let attr_len = 2 + key.length + 1 + 1;
    if (type >= ATTR_TYPE_BYTE && type <= ATTR_TYPE_BOOLEAN)
        attr_len += 1 << (type & 3);
    else if (type == ATTR_TYPE_STRING) attr_len += 2 + value_length;
    else if (type == ATTR_TYPE_BYTEARRAY) attr_len += 4 + value_length;

    const attr_buf = new ArrayBuffer(attr_len);
    const attr_buf_dataview = new DataView(attr_buf);
    p = 0;
    /* Set the attr buf */
    const str_len = key.length + 1;
    attr_buf_dataview.setUint16(p, str_len, true);
    p += 2;
    for (let i = 0; i < key.length; i++) {
        attr_buf_dataview.setUint8(i + p, key.charCodeAt(i));
    }
    /* string length also includes /0 in C */
    attr_buf_dataview.setUint8(p + str_len - 1, 0);
    p += str_len;

    attr_buf_dataview.setUint8(p, type);
    p++;
    if (type >= ATTR_TYPE_BYTE && type <= ATTR_TYPE_BOOLEAN) {
        const len = 1 << (type & 3);
        for (let i = 0; i < len; i++) {
            attr_buf_dataview.setUint8(p + i, value_dataview.getUint8(i));
        }
    } else if (type == ATTR_TYPE_STRING) {
        attr_buf_dataview.setUint16(p, value_length, true);
        p += 2;
        for (let i = 0; i < value_dataview.byteLength; i++) {
            attr_buf_dataview.setUint8(p + i, value_dataview.getUint8(i));
        }
        /* string length also includes /0 in C */
        attr_buf_dataview.setUint8(p + value_length - 1, 0);
    } else if (type == ATTR_TYPE_BYTEARRAY) {
        attr_buf_dataview.setUint32(p, value_length, true);
        p += 4;
        for (let i = 0; i < value_dataview.byteLength; i++) {
            attr_buf_dataview.setUint8(p + i, value_dataview.getUint8(i));
        }
        /* string length also includes /0 in C */
        attr_buf_dataview.setUint8(p + value_length - 1, 0);
    }

    p = attr_container_find_attr(attr_cont, key);
    if (p !== -1) {
        /* key found */
        const p1 = attr_container_get_attr_next(attr_cont, p)!;

        if (p1 - p == attr_len) {
            for (let i = 0; i < attr_len; i++) {
                dataview.setUint8(i + p, attr_buf_dataview.getUint8(i));
            }
            global_attr_cont = attr_cont;
            return true;
        }

        if (p1 - p + msg_end - attr_end >= attr_len) {
            for (let i = 0; i < attr_end - p1; i++) {
                dataview.setUint8(p + i, dataview.getUint8(p1 + i));
            }
            for (let i = 0; i < attr_len; i++) {
                dataview.setUint8(
                    i + p + (attr_end - p1),
                    attr_buf_dataview.getUint8(i),
                );
            }
            global_attr_cont = attr_cont;
            return true;
        }

        total_length += attr_len + 100;

        const attr_cont1 = new ArrayBuffer(2 + total_length);
        const attr_cont1_dataview = new DataView(attr_cont1);
        for (let i = 0; i < p; i++) {
            attr_cont1_dataview.setUint8(i, dataview.getUint8(i));
        }
        for (let i = 0; i < attr_end - p1; i++) {
            attr_cont1_dataview.setUint8(i + p, dataview.getUint8(i + p1));
        }
        for (let i = 0; i < attr_len; i++) {
            attr_cont1_dataview.setUint8(
                i + p + attr_end - p1,
                attr_buf_dataview.getUint8(i),
            );
        }
        p = 2;
        attr_cont1_dataview.setUint32(p, total_length, true);
        global_attr_cont = attr_cont1;
        return true;
    } else {
        /* key not found */
        if (msg_end - attr_end >= attr_len) {
            for (let i = 0; i < attr_len; i++) {
                dataview.setUint8(i + attr_end, attr_buf_dataview.getUint8(i));
            }
            attr_container_inc_attr_num(attr_cont);
            global_attr_cont = attr_cont;
            return true;
        }

        total_length += attr_len + 100;
        const attr_cont1 = new ArrayBuffer(2 + total_length);
        const attr_cont1_dataview = new DataView(attr_cont1);
        for (let i = 0; i < attr_end; i++) {
            attr_cont1_dataview.setUint8(i, dataview.getUint8(i));
        }
        for (let i = 0; i < attr_len; i++) {
            attr_cont1_dataview.setUint8(
                i + attr_end,
                attr_buf_dataview.getUint8(i),
            );
        }
        attr_container_inc_attr_num(attr_cont1);
        p = 2;
        attr_cont1_dataview.setUint32(p, total_length, true);
        global_attr_cont = attr_cont1;
        return true;
    }
}
