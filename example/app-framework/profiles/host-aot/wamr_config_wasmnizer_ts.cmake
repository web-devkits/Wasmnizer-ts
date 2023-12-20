# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
set (WAMR_BUILD_PLATFORM "linux")
set (WAMR_BUILD_TARGET X86_64)
set (WAMR_BUILD_INTERP 1)
set (WAMR_BUILD_AOT 1)
set (WAMR_BUILD_JIT 0)
set (WAMR_BUILD_SIMD 1)
set (WAMR_BUILD_LIBC_BUILTIN 1)
set (WAMR_BUILD_LIBC_WASI 0)
set (WAMR_BUILD_APP_FRAMEWORK 1)
set (WAMR_BUILD_APP_LIST WAMR_APP_BUILD_BASE WAMR_APP_BUILD_CONNECTION WAMR_APP_BUILD_SENSOR)
set (WAMR_BUILD_GC 1)
set (WAMR_BUILD_GC_BINARYEN 1)
set (WAMR_BUILD_STRINGREF 1)
set (USE_SIMPLE_LIBDYNTYPE 1)

set (RUNTIMR_DIR ${CMAKE_CURRENT_LIST_DIR}/../../../../runtime-library)
## stringref
set(STRINGREF_DIR ${RUNTIMR_DIR}/stringref)
set(WAMR_STRINGREF_IMPL_SOURCE
    ${STRINGREF_DIR}/stringref_simple.c
)

## quickjs
set(QUICKJS_SRC_DIR ${RUNTIMR_DIR}/deps/quickjs)

include_directories(${QUICKJS_SRC_DIR})

## libdyntype
set(LIBDYNTYPE_DIR ${RUNTIMR_DIR}/libdyntype)
include (${LIBDYNTYPE_DIR}/libdyntype.cmake)



