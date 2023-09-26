#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

import gdb
from constants import *

### common utils
def get_bits(val, size, offset = 0):
    mask = ((1 << size) - 1) << offset
    return (val & mask) >> offset

def get_bit(val, offset = 0):
    return get_bits(val, 1, offset)

### hmu utils
def obj_to_hmu(obj):
    return int(obj) - HMU_HEADER_SIZE

def hmu_to_obj(hmu):
    return int(hmu) + HMU_HEADER_SIZE

def hmu_get_size(hmu):
    return get_bits(hmu, HMU_SIZE_SIZE, HMU_SIZE_OFFSET) << 3

def hmu_get_ut(hmu):
    return HMU_UT_MAP[get_bits(hmu, HMU_UT_SIZE, HMU_UT_OFFSET)]

def hmu_get_pinuse(hmu):
    return get_bit(HMU_P_OFFSET)

def hmu_get_vo_marked(hmu):
    return get_bit(HMU_WO_MB_OFFSET)

## rtt utils
def obj_get_rtt_ref(obj):
    return obj.cast(
        gdb.lookup_type('wasm_obj_t')
    ).dereference()['header'].cast(
        gdb.lookup_type('WASMRttTypeRef')
    )

def rtt_get_defined_type_ref(rtt):
    return rtt['defined_type'].cast(
        gdb.lookup_type('wasm_defined_type_t')
    )
