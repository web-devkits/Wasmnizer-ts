/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function random_f64() {
    let m_w: f64 = 123456789;
    let m_z: f64 = 987654321;
    let mask: f64 = 0xffffffff;
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result: f64 = (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296;
    return result;
}

export function random_i64() {
    let m_w: i64 = 123456789;
    let m_z: i64 = 987654321;
    let mask: i64 = 0xffffffff;
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result: i64 = (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296;
    return result;
}

export function random_i32() {
    let m_w: i32 = 123456789;
    let m_z: i32 = 987654321;
    let mask: i32 = 0xffffffff;
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result: i32 = (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296;
    return result;
}

export function random_f32() {
    let m_w: f32 = 123456789;
    let m_z: f32 = 987654321;
    let mask: f32 = 0xffffffff;
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result: f32 = (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296;
    return result;
}
