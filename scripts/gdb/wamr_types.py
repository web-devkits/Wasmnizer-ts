#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

import gdb
from constants import *

class WASMType:
    def __init__(self):
        pass

    @staticmethod
    def create_type(ref):
        type = ref.cast(
            gdb.lookup_type('WASMType').pointer()
        ).dereference()

        try:
            type_flag = TYPE_KIND[int(type['type_flag'])]
            if type_flag == 'WASM_TYPE_ARRAY':
                return WASMArrayType(ref)
            elif type_flag == 'WASM_TYPE_STRUCT':
                return WASMStructType(ref)
            elif type_flag == 'WASM_TYPE_FUNC':
                return WASMFuncType(ref)
            else:
                return None
        except (gdb.MemoryError, IndexError) as e:
            print(f'{RED}Not a WASMType{ENDC}')
            return None

class WASMArrayType(WASMType):
    def __init__(self, ref):
        super().__init__()

        self.ref = ref
        self.type = ref.cast(
            gdb.lookup_type('WASMArrayType').pointer()
        ).dereference()

    def __str__(self):
        return f'{GREEN}WASMArrayType: {hex(self.ref)}\n' + \
            f'  * elem type: {WASM_TYPE_MAP[int(self.type["elem_type"])]}{ENDC}\n'

class WASMStructType(WASMType):
    def __init__(self, ref):
        super().__init__()

        self.ref = ref
        self.type = ref.cast(
            gdb.lookup_type('WASMStructType').pointer()
        ).dereference()

    def _get_fields_info(self):
        fields_info = []
        for i in range(self.type["field_count"]):
            field_type = self.type["fields"][i]
            field_info = {
                'flag': int(field_type['field_flags']),
                'type': WASM_TYPE_MAP[int(field_type['field_type'])],
                'size': int(field_type['field_size']),
                'offset': int(field_type['field_offset']),
            }
            # for ref ht type, get its ref type
            if field_info['type'] == 'REF_TYPE_HT_NON_NULLABLE' \
                or field_info['type'] == 'REF_TYPE_HT_NULLABLE':
                ref_type_map = self.type['ref_type_maps']
                ret_type_count = int(self.type['ref_type_map_count'])
                for j in range(ret_type_count):
                    ref_type = ref_type_map[j]
                    if (ref_type['index'] == i):
                        field_info['type'] += \
                            f" (typeid={int(ref_type['ref_type']['ref_ht_typeidx']['type_idx'])})"

            fields_info.append(field_info)
        return fields_info

    def _create_fields_description(self):
        fields_info = self._get_fields_info()
        description = ''
        index = 0
        for field in fields_info:
            description += f'    #[{index}]  type:\t{field["type"]}\n'
            description += f'\t  mut:\t{"true" if field["flag"] & 1 else "false"}\n'
            description += f'\t  offset:\t{field["offset"]}\n'
            description += f'\t  size:\t{field["size"]}\n'
            index += 1

        return description

    def __str__(self):
        return f'{GREEN}WASMStructType: {hex(self.ref)}\n' + \
            f'  * parent type: {self.type["base_type"]["parent_type_idx"]}\n' + \
            f'  * field count: {self.type["field_count"]}\n' + \
            f'  * fields info:\n' + \
            self._create_fields_description() + \
            f'{ENDC}'

class WASMFuncType(WASMType):
    def __init__(self, ref):
        super().__init__()

        self.ref = ref
        self.type = ref.cast(
            gdb.lookup_type('WASMFuncType').pointer()
        ).dereference()

        self.param_count = int(self.type["param_count"])
        self.result_count = int(self.type["result_count"])

    def _get_reftype_id(self, i):
        ref_type_map = self.type['ref_type_maps']
        ret_type_count = int(self.type['ref_type_map_count'])
        for j in range(ret_type_count):
            ref_type = ref_type_map[j]
            if (ref_type['index'] == i):
                return int(ref_type['ref_type']['ref_ht_typeidx']['type_idx'])

    def _get_parameter_types(self):
        types = []

        for i in range(self.param_count):
            type = WASM_TYPE_MAP[int(self.type["types"][i])]
            # for ref ht type, get its ref type
            if type == 'REF_TYPE_HT_NON_NULLABLE' \
                or type == 'REF_TYPE_HT_NULLABLE':
                type += f' (typeid={self._get_reftype_id(i)})'
            types.append(type)

        return types

    def _get_result_types(self):
        types = []

        for i in range(self.param_count, self.param_count + self.result_count):
            type = WASM_TYPE_MAP[int(self.type["types"][i])]
            # for ref ht type, get its ref type
            if type == 'REF_TYPE_HT_NON_NULLABLE' \
                or type == 'REF_TYPE_HT_NULLABLE':
                type += f' (typeid={self._get_reftype_id(i)})'
            types.append(type)

        return types

    def _get_description(self, results = False):
        types = self._get_result_types() if results else self._get_parameter_types()

        description = ''
        index = 0
        for type in types:
            description += f'    #[{index}]\t{type}\n'
            index += 1

        return description

    def __str__(self):
        return f'{GREEN}WASMFuncType: {hex(self.ref)}\n' + \
            f'  * param count: {self.type["param_count"]}\n' + \
            f'  * result count: {self.type["result_count"]}\n' + \
            f'  * parameters:\n' + \
            self._get_description() + \
            f'  * results:\n' + \
            self._get_description(results=True) + \
            f'{ENDC}'
