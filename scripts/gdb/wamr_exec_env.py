#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

import gdb

from constants import *
from utils import *
from wamr_types import *

class WASMFunction:
    def __init__(self, ref):
        self.ref = ref
        value = ref.cast(
            gdb.lookup_type('WASMFunctionInstance').pointer()
        )
        self.func = value.dereference()

        self.is_import_func = bool(self.func['is_import_func'])
        self.param_count = int(self.func['param_count'])
        self.local_count = int(self.func['local_count'])
        self.param_cell_num = int(self.func['param_cell_num'])
        self.ret_cell_num = int(self.func['ret_cell_num'])
        self.local_cell_num = int(self.func['local_cell_num'])
        self.local_offsets = self.func['local_offsets']
        self.param_types = self.func['param_types']
        self.local_types = self.func['local_types']

        if (self.is_import_func):
            self.import_func = self.func['u']['func_import']
            self.import_module = self.import_func['module_name']
            self.import_field = self.import_func['field_name']
            self.func_type = WASMFuncType(self.import_func['func_type'])
        else:
            self.func_type = WASMFuncType(self.func['u']['func']['func_type'])

        self.func_fields = [field.name for field in self.func.type.fields()]

    def get_max_stack_cell_num(self):
        max_local_slot = self.param_cell_num + self.local_cell_num
        if (self.is_import_func):
            return max_local_slot
        else:
            return max_local_slot + int(self.func['u']['func']['max_stack_cell_num'])

    def __str__(self):
        if (self.func.address == 0):
            return f'{GREEN}WASMFunctionInstance: null\n{ENDC}'

        import_name = f'{self.import_module}|{self.import_field}' if self.is_import_func else "no"
        return f'{GREEN}WASMFunctionInstance: {hex(self.ref)}\n' + \
            f'  * import func: {import_name}\n' + \
            f'  * local_count: {self.local_count}\n' + \
            f'  * ret_cell_num: {self.ret_cell_num}\n' + \
            f'{ENDC}\n' + \
            str(self.func_type)

class WASMInterpFrame:
    def __init__(self, ref):
        self.ref = ref
        value = ref.cast(
            gdb.lookup_type('WASMInterpFrame').pointer()
        )
        self.interp_frame = value.dereference()

        self.fast_interp = False

        # mode detection
        self.interp_frame_fields = [field.name for field in self.interp_frame.type.fields()]

        if ('ret_offset' in self.interp_frame_fields):
            self.fast_interp = True

    def _get_feature_description(self):
        features = ''
        features += f'  * fast_interp: {"on" if self.fast_interp else "off"}\n'

        return features

    def get_prev_frame(self):
        ref = self.interp_frame['prev_frame']
        if (ref != 0):
            return WASMInterpFrame(ref)

        return None

    def _get_operand_stack(self):
        return self.interp_frame['lp']

    def get_stack_addr(self, index):
        return self._get_operand_stack()[index].address

    def get_stack_i32(self, index):
        return self._get_operand_stack()[index]

    def get_stack_i64(self, index):
        addr = self.get_stack_addr(index)
        return gdb.Value(addr).cast(gdb.lookup_type('int64_t').pointer()).dereference()

    def get_stack_f32(self, index):
        addr = self.get_stack_addr(index)
        return gdb.Value(addr).cast(gdb.lookup_type('float').pointer()).dereference()

    def get_stack_f64(self, index):
        addr = self.get_stack_addr(index)
        return gdb.Value(addr).cast(gdb.lookup_type('double').pointer()).dereference()

    def get_stack_ref(self, index):
        addr = self.get_stack_addr(index)
        return gdb.Value(addr).cast(gdb.lookup_type('void').pointer().pointer()).dereference()

    def _get_conditional_info(self):
        info = ''
        if ('ret_offset' in self.interp_frame_fields):
            info += f'  * ret_offset: {int(self.interp_frame["ret_offset"])}\n'
        if ('lp' in self.interp_frame_fields):
            info += f'  * lp: {self.interp_frame["lp"]}\n'
        if ('operand' in self.interp_frame_fields):
            info += f'  * operand: {self.interp_frame["operand"]}\n'
        if ('sp_bottom' in self.interp_frame_fields):
            info += f'  * sp_bottom: {hex(int(self.interp_frame["sp_bottom"]))}\n'
        if ('sp_boundary' in self.interp_frame_fields):
            info += f'  * sp_boundary: {hex(int(self.interp_frame["sp_boundary"]))}\n'
        if ('sp' in self.interp_frame_fields):
            info += f'  * sp: {hex(int(self.interp_frame["sp"]))}\n'
        if ('csp_bottom' in self.interp_frame_fields):
            info += f'  * csp_bottom: {hex(int(self.interp_frame["csp_bottom"]))}\n'
        if ('csp_boundary' in self.interp_frame_fields):
            info += f'  * csp_boundary: {hex(int(self.interp_frame["csp_boundary"]))}\n'
        if ('csp' in self.interp_frame_fields):
            info += f'  * csp: {hex(int(self.interp_frame["csp"]))}\n'

        if ('frame_ref' in self.interp_frame_fields):
            info += f'  * frame_ref: {hex(int(self.interp_frame["frame_ref"]))}\n'

        if (int(self.interp_frame["function"]) != 0):
            func = WASMFunction(self.interp_frame["function"])

            max_cell_num = func.get_max_stack_cell_num()
            param_cell_num = func.param_cell_num
            local_cell_num = func.local_cell_num

            # dump operand stack content
            frame_ref_array = None
            lp_array = None
            ## Check if GC enabled
            if ('frame_ref' in self.interp_frame_fields):
                # fast interpreter
                frame_ref_array = self.interp_frame['frame_ref'].cast(
                    gdb.lookup_type('uint8_t').pointer()
                )
            else:
                # classic interpreter
                try:
                    func = gdb.parse_and_eval('get_frame_ref')
                    if func.type.code == gdb.TYPE_CODE_FUNC:
                        res = func(self.ref)
                        frame_ref_array = res.cast(
                            gdb.lookup_type('uint8_t').pointer()
                        )
                except gdb.error:
                    pass

            if ('operand' in self.interp_frame_fields):
                lp_array = self.interp_frame['lp'].cast(
                    gdb.lookup_type('uint32_t').pointer()
                )
            else:
                lp_array = self.interp_frame['lp']

            if (max_cell_num > 0):
                if (frame_ref_array or lp_array):
                    data = []
                    value_len = 15
                    header = [f'slot', f'{"value":^{value_len}}']
                    row_seperator = f'\t+{"—" * 6}+—{"—" * value_len}—+\n'
                    if (frame_ref_array):
                        header.append('ref')
                        row_seperator = f'\t+{"—" * 6}+—{"—" * value_len}—+{"—" * 5}+\n'

                    for i in range(max_cell_num):
                        row = [f'{i:^4}']
                        if lp_array:
                            row.append(f'{int(lp_array[i]):^{value_len}}')
                        if (frame_ref_array):
                            row.append(f'{int(frame_ref_array[i]):^3}')
                        data.append(row)

                    info += f'  * operand stack:\n'
                    info += row_seperator
                    info += f'\t| {" | ".join(header)} |\n'
                    info += row_seperator
                    for i in range(len(data)):
                        row = data[i]
                        info += f'\t| {" | ".join([str(x) for x in row])} |'
                        if (i == param_cell_num - 1):
                            info += ' <--- param end'
                        if (i == param_cell_num + local_cell_num - 1):
                            info += ' <--- local end'
                        if (i == param_cell_num + local_cell_num):
                            info += ' <--- dynamic space start'
                        if ('sp' in self.interp_frame_fields and i == int(self.interp_frame['sp'])):
                            info += f'{PURPLE} <--- sp{GREEN}'
                        if ('ret_offset' in self.interp_frame_fields and i == int(self.interp_frame['ret_offset'])):
                            info += f'{PURPLE} <--- ret_offset{GREEN}'
                        info += '\n'
                    info += row_seperator

        return info

    def __str__(self) -> str:
        return f'{GREEN}WASMInterpFrame: {hex(self.ref)}\n' + \
            self._get_feature_description() + \
            f'  * prev_frame: {hex(self.interp_frame["prev_frame"])}\n' + \
            f'  * function: {hex(self.interp_frame["function"])}\n' + \
            f'  * ip: {hex(self.interp_frame["ip"])}\n' + \
            self._get_conditional_info() + \
            f'{ENDC}\n'

class WASMExecEnv:
    def __init__(self, ref):
        self.ref = ref
        self.exec_env = ref.cast(
            gdb.lookup_type('wasm_exec_env_t')
        ).dereference()

        self.prev = self.exec_env['prev']
        self.next = self.exec_env['next']

        self.interp_mode = 'classic'
        self.hw_bound_check = False
        self.gc_enabled = False
        self.fastjit_enabled = False
        self.thread_mgr = False
        self.aot_enabled = False
        self.source_debugger = False
        self.wasm_stack_size = int(self.exec_env['wasm_stack_size'])
        self.thread = hex(int(self.exec_env['handle']))
        self.suspend_flags = hex(int(self.exec_env['suspend_flags']['flags']))

        cur_frame_val = self.exec_env['cur_frame']
        if (cur_frame_val != 0):
            self.current_frame = WASMInterpFrame(cur_frame_val)
        else:
            self.current_frame = None

        # mode detection
        exec_env_fields = [field.name for field in self.exec_env.type.fields()]

        if ('block_addr_cache' not in exec_env_fields):
            self.interp_mode = 'fast'
        if ('jmpbuf_stack_top' in exec_env_fields):
            self.hw_bound_check = True
        if ('cur_local_object_ref' in exec_env_fields):
            self.gc_enabled = True
        if ('jit_cache' in exec_env_fields):
            self.fastjit_enabled = True
        if ('cluster' in exec_env_fields):
            self.thread_mgr = True
        if ('argv_buf' in exec_env_fields):
            self.aot_enabled = True
        if ('current_status' in exec_env_fields):
            self.source_debugger = True

    def get_cur_frame(self):
        return self.current_frame

    def _get_dynamic_info(self):
        frame_num = 0
        info = ''

        cur_frame = self.current_frame
        while (cur_frame):
            frame_num += 1
            cur_frame = cur_frame.get_prev_frame()

        info += f'  * frame_count: {frame_num}\n'

        return info

    def _get_feature_description(self):
        features = '  * features:\n'
        features += f'    - interp_mode: {self.interp_mode}\n'
        features += f'    - hw_bound_check: {"on" if self.hw_bound_check else "off"}\n'
        features += f'    - gc: {"on" if self.gc_enabled else "off"}\n'
        features += f'    - fastjit: {"on" if self.fastjit_enabled else "off"}\n'
        features += f'    - thread_mgr: {"on" if self.thread_mgr else "off"}\n'
        features += f'    - aot: {"on" if self.aot_enabled else "off"}\n'
        features += f'    - source_debugger: {"on" if self.source_debugger else "off"}\n'

        return features

    def __str__(self) -> str:
        return f'{GREEN}WASMExecEnv: {hex(self.ref)}\n' + \
            f'  * prev: {hex(self.prev)}\n' + \
            f'  * next: {hex(self.next)}\n' + \
            f'  * wasm_stack_size: {self.wasm_stack_size}\n' + \
            f'  * thread: {self.thread}\n' + \
            f'  * suspend_flags: {self.suspend_flags}\n' + \
            f'  * current_frame: {self.current_frame.ref if self.current_frame else "null"}\n' + \
            self._get_dynamic_info() + \
            self._get_feature_description() + \
            f'{ENDC}\n'
