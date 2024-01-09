/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

var m_w = 123456789;
var m_z = 987654321;
var mask = 0xffffffff;

export function random() {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    var result = (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296;
    return result;
}
