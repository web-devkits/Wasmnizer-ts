#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

set (WAMR_DIR ${CMAKE_CURRENT_LIST_DIR}/deps/wamr-gc)

set (WAMR_BUILD_PLATFORM "linux")

set (WAMR_BUILD_INTERP 1)
set (WAMR_BUILD_LIBC_BUILTIN 1)
set (WAMR_BUILD_GC_BINARYEN 1)

if (NOT DEFINED WAMR_BUILD_TARGET)
    set (WAMR_BUILD_TARGET X86_64)
endif()

if (NOT DEFINED WAMR_BUILD_FAST_INTERP)
    set (WAMR_BUILD_FAST_INTERP 1)
endif()

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
