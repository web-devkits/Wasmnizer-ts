#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

import gdb
from utils import *
from wamr_types import *

class HMU:
    def __init__(self, hmu):
        self.hmu = hmu
        self.hmu_header_val = gdb.Value(hmu).cast(
            gdb.lookup_type(HMU_HEADER_TYPE).pointer()).dereference()
        self.hmu_size = hmu_get_size(self.hmu_header_val)
        self.hmu_ut = hmu_get_ut(self.hmu_header_val)
        self.hmu_pinuse = hmu_get_pinuse(self.hmu_header_val)
        self.hmu_vo_marked = hmu_get_vo_marked(self.hmu_header_val)

    def __str__(self):
        return f'{BLUE}Heap Management Unit: {hex(self.hmu)}\n' + \
            f'  * hmu size: {self.hmu_size}\n' + \
            f'  * hmu ut: {self.hmu_ut}\n' + \
            f'  * pinuse: {"true" if self.hmu_pinuse else "false"}\n' + \
            f'  * marked: {"true" if self.hmu_vo_marked else "false"}\n{ENDC}'

class WASMRtt:
    def __init__(self, rtt_ref):
        self.rtt_ref = rtt_ref
        if ((int(rtt_ref) & WASM_OBJ_EXTERNREF_OBJ_FLAG) == WASM_OBJ_EXTERNREF_OBJ_FLAG):
            self.type_flag = 'WASM_TYPE_EXTERNREF'
        elif ((int(rtt_ref) & WASM_OBJ_ANYREF_OBJ_FLAG) == WASM_OBJ_ANYREF_OBJ_FLAG):
            self.type_flag = 'WASM_TYPE_ANYREF'
        else:
            self.rtt = rtt_ref.dereference()
            self.type_flag = TYPE_KIND[self.rtt["type_flag"]]
            self.inherit_depth = self.rtt["inherit_depth"]

    def _get_description(self):
        if (self.type_flag == 'WASM_TYPE_EXTERNREF'):
            return f'{YELLOW}Runtime Type: {hex(self.rtt_ref)} (externref){ENDC}\n'
        elif (self.type_flag == 'WASM_TYPE_ANYREF'):
            return f'{YELLOW}Runtime Type: {hex(self.rtt_ref)} (anyref){ENDC}\n'
        else:
            return f'{YELLOW}Runtime Type: {hex(self.rtt_ref)}\n' + \
                f'  * flag: {self.type_flag}\n' + \
                f'  * inherit_depth: {self.inherit_depth}\n{ENDC}'

    def __str__(self):
        return self._get_description()

class WASMObj:
    def __init__(self, obj, hmu, rtt):
        self.obj = obj
        self.hmu = hmu
        self.rtt = rtt

    @staticmethod
    def create_obj(obj_ref):
        if (get_bit(int(obj_ref))):
            return WASMI31Obj(int(obj_ref) >> 1)
        else:
            try:
                hmu = HMU(obj_to_hmu(obj_ref))
                rtt = WASMRtt(obj_get_rtt_ref(obj_ref))

                type_flag = rtt.type_flag
                if type_flag == 'WASM_TYPE_ARRAY':
                    return WASMArrayObj(obj_ref, hmu, rtt)
                elif type_flag == 'WASM_TYPE_STRUCT':
                    return WASMStructObj(obj_ref, hmu, rtt)
                elif type_flag == 'WASM_TYPE_FUNC':
                    return WASMFuncObj(obj_ref, hmu, rtt)
                elif type_flag == 'WASM_TYPE_EXTERNREF':
                    return WASMExternRefObj(obj_ref, hmu, rtt)
                elif type_flag == 'WASM_TYPE_ANYREF':
                    return WASMAnyRefObj(obj_ref, hmu, rtt)
                else:
                    return None
            except gdb.MemoryError as e:
                print(f'{RED}Not a WasmGC object{ENDC}')
                return None

class WASMI31Obj:
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return f'{GREEN}WASM I31: {self.value} ({hex(self.value)}){ENDC}'

class WASMExternRefObj(WASMObj):
    def __init__(self, obj, hmu, rtt):
        super().__init__(obj, hmu, rtt)
        self.ref = obj
        self.extern_ref_obj = obj.cast(
            gdb.lookup_type('wasm_externref_obj_t')
        ).dereference()

    def __str__(self):
        return f'{PURPLE}WASMExternRefObj: {hex(self.ref)}\n' + \
            f'  * internal_obj: {hex(self.extern_ref_obj["internal_obj"])}\n{ENDC}' + \
            str(self.hmu) + str(self.rtt)

class WASMAnyRefObj(WASMObj):
    def __init__(self, obj, hmu, rtt):
        super().__init__(obj, hmu, rtt)
        self.ref = obj
        self.anyref_obj = obj.cast(
            gdb.lookup_type('wasm_anyref_obj_t')
        ).dereference()

    def __str__(self):
        return f'{PURPLE}WASMAnyRefObj: {hex(self.ref)}\n' + \
            f'  * host_ptr: {self.anyref_obj["host_obj"]}\n{ENDC}' + \
            str(self.hmu) + str(self.rtt)

class WASMArrayObj(WASMObj):
    def __init__(self, obj, hmu, rtt):
        super().__init__(obj, hmu, rtt)
        self.ref = obj
        self.array_obj = obj.cast(
            gdb.lookup_type('wasm_array_obj_t')
        ).dereference()
        self.array_type = WASMType.create_type(
            rtt_get_defined_type_ref(rtt.rtt).cast(
                gdb.lookup_type('wasm_array_type_t')
            )
        )

    def __str__(self):
        return f'{PURPLE}WASMArrayObj: {hex(self.ref)}\n' + \
            f'  * array length: {self.array_obj["length"] >> WASM_ARRAY_LENGTH_SHIFT}\n' + \
            f'  * elem size: {1 << (self.array_obj["length"] & WASM_ARRAY_ELEM_SIZE_MASK)}\n{ENDC}' + \
            str(self.array_type) + str(self.hmu) + str(self.rtt)

class WASMStructObj(WASMObj):
    def __init__(self, obj, hmu, rtt):
        super().__init__(obj, hmu, rtt)
        self.ref = obj
        self.struct_obj = obj.cast(
            gdb.lookup_type('wasm_struct_obj_t')
        ).dereference()
        self.struct_type = WASMType.create_type(
            rtt_get_defined_type_ref(rtt.rtt).cast(
                gdb.lookup_type('wasm_struct_type_t')
            )
        )

    def __str__(self):
        return f'{PURPLE}WASMStructObj: {hex(self.ref)}\n' + \
            f'{ENDC}' + \
            str(self.struct_type) + str(self.hmu) + str(self.rtt)

class WASMFuncObj(WASMObj):
    def __init__(self, obj, hmu, rtt):
        super().__init__(obj, hmu, rtt)
        self.ref = obj
        self.func_obj = obj.cast(
            gdb.lookup_type('wasm_func_obj_t')
        ).dereference()
        self.func_type = WASMType.create_type(
            rtt_get_defined_type_ref(rtt.rtt).cast(
                gdb.lookup_type('wasm_func_type_t')
            )
        )

    def __str__(self):
        return f'{PURPLE}WASMFuncObj: {hex(self.ref)}\n' + \
            f'  * bound func: {self.func_obj["func_idx_bound"]}\n' + \
            f'{ENDC}' + \
            str(self.func_type) + str(self.hmu) + str(self.rtt)
