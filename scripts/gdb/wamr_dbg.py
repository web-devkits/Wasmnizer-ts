#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

import gdb
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from utils import *
from constants import *
from wamr_objects import *
from wamr_types import *
from wamr_exec_env import *

# enable auto completion for gdb
# import rlcompleter, readline; readline.parse_and_bind("tab: complete")

def _get_ref(arg):
    if (type(arg) == int):
        ref = gdb.Value(arg)
    elif (type(arg) == str):
        ref = gdb.parse_and_eval(arg)
    else:
        ref = arg

    return ref

def wamr_get_type(arg):
    ref = _get_ref(arg)

    return WASMType.create_type(ref)

def wamr_type_dump(arg):
    wasm_type = wamr_get_type(arg)

    if (wasm_type):
        print(wasm_type)


def wamr_get_gc_obj(arg):
    ref = _get_ref(arg)

    return WASMObj.create_obj(ref)

def wamr_gc_obj_dump(arg):
    wasm_obj = wamr_get_gc_obj(arg)

    if (wasm_obj):
        print(wasm_obj)

def wamr_get_exec_env(arg):
    ref = _get_ref(arg)

    return WASMExecEnv(ref)

def wamr_exec_env_dump(arg):
    wasm_exec = wamr_get_exec_env(arg)

    if (wasm_exec):
        print(wasm_exec)

def wamr_get_interp_frame(arg):
    ref = _get_ref(arg)

    return WASMInterpFrame(ref)

def wamr_interp_frame_dump(arg):
    wasm_frame = wamr_get_interp_frame(arg)

    if (wasm_frame):
        print(wasm_frame)

def wamr_interp_frame_dump_all(arg):
    wasm_frame = wamr_get_interp_frame(arg)

    while (wasm_frame):
        print(wasm_frame)
        wasm_frame = wasm_frame.get_prev_frame()

def wamr_exec_env_dump_all_interp_frame(arg):
    exec_env = wamr_get_exec_env(arg)

    if (exec_env):
        cur_frame = exec_env.get_cur_frame()
        while (cur_frame):
            print(cur_frame)
            cur_frame = cur_frame.get_prev_frame()

def wamr_operand_stack_get_addr(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_addr(int(index))

def wamr_operand_stack_get_i32(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_i32(int(index))

def wamr_operand_stack_get_i64(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_i64(int(index))

def wamr_operand_stack_get_f32(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_f32(int(index))

def wamr_operand_stack_get_f64(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_f64(int(index))

def wamr_operand_stack_get_ref(arg1, arg2):
    wasm_frame = wamr_get_interp_frame(arg1)
    index = _get_ref(arg2)

    if (wasm_frame):
        return wasm_frame.get_stack_ref(int(index))

def wamr_operand_stack_get_obj(arg1, arg2):
    ref = wamr_operand_stack_get_ref(arg1, arg2)

    wamr_gc_obj_dump(ref)

def wamr_get_function(arg):
    ref = _get_ref(arg)

    return WASMFunction(ref)

def wamr_function_dump(arg):
    wasm_frame = wamr_get_function(arg)

    if (wasm_frame):
        print(wasm_frame)

# register commands
gdb.execute("define wamr_type_dump\n" +
            "python wamr_type_dump('$arg0')\n" +
            "end")

gdb.execute("define wamr_function_dump\n" +
            "python wamr_function_dump('$arg0')\n" +
            "end")

gdb.execute("define wamr_gc_obj_dump\n" +
            "python wamr_gc_obj_dump('$arg0')\n" +
            "end")

gdb.execute("define wamr_exec_env_dump\n" +
            "python wamr_exec_env_dump('$arg0')\n" +
            "end")

gdb.execute("define wamr_exec_env_dump_all_interp_frame\n" +
            "python wamr_exec_env_dump_all_interp_frame('$arg0')\n" +
            "end")

## frame operation
gdb.execute("define wamr_interp_frame_dump\n" +
            "python wamr_interp_frame_dump('$arg0')\n" +
            "end")

gdb.execute("define wamr_interp_frame_dump_all\n" +
            "python wamr_interp_frame_dump_all('$arg0')\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_addr\n" +
            "python print(wamr_operand_stack_get_addr('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_i32\n" +
            "python print(wamr_operand_stack_get_i32('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_i64\n" +
            "python print(wamr_operand_stack_get_i64('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_f32\n" +
            "python print(wamr_operand_stack_get_f32('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_f64\n" +
            "python print(wamr_operand_stack_get_f64('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_ref\n" +
            "python print(wamr_operand_stack_get_ref('$arg0', '$arg1'))\n" +
            "end")

gdb.execute("define wamr_operand_stack_get_obj\n" +
            "python print(wamr_operand_stack_get_obj('$arg0', '$arg1'))\n" +
            "end")
