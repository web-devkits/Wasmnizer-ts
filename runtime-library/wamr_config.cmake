#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

set (WAMR_DIR ${CMAKE_CURRENT_LIST_DIR}/deps/wamr-gc)

set (WAMR_BUILD_PLATFORM "linux")

set (WAMR_BUILD_INTERP 1)
set (WAMR_BUILD_LIBC_BUILTIN 1)
set (WAMR_BUILD_GC_BINARYEN 1)
set (WAMR_BUILD_STRINGREF 1)
add_definitions(-DWASM_TABLE_MAX_SIZE=10240)

if (NOT DEFINED WAMR_BUILD_TARGET)
    set (WAMR_BUILD_TARGET X86_64)
endif()

if (NOT DEFINED WAMR_BUILD_FAST_INTERP)
    set (WAMR_BUILD_FAST_INTERP 1)
endif()

if (NOT DEFINED WAMR_BUILD_SIMD)
  # Enable SIMD by default
  set (WAMR_BUILD_SIMD 1)
endif ()

if (NOT DEFINED WAMR_BUILD_AOT)
  # Enable AOT by default
  set (WAMR_BUILD_AOT 1)
endif ()

## stringref
set(STRINGREF_DIR ${CMAKE_CURRENT_LIST_DIR}/stringref)
set(WAMR_STRINGREF_IMPL_SOURCE
    ${STRINGREF_DIR}/stringref_qjs.c
)

if (WAMR_GC_IN_EVERY_ALLOCATION EQUAL 1)
    message("* Garbage collection in every allocation: on")
    # Force GC in every allocation during testing
    add_definitions(-DGC_IN_EVERY_ALLOCATION=1)
endif()

if (DEFINED WAMR_GC_HEAP_SIZE)
    message("* Set WAMR gc heap size: ${WAMR_GC_HEAP_SIZE}")
    add_definitions(-DGC_HEAP_SIZE_DEFAULT=${WAMR_GC_HEAP_SIZE})
endif()

include(${WAMR_DIR}/build-scripts/runtime_lib.cmake)
