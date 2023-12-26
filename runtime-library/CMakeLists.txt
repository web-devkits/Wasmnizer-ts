#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

cmake_minimum_required(VERSION 2.8)

project(iwasm_gc)

if (NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif ()

if (NOT DEFINED USE_SIMPLE_LIBDYNTYPE)
  set(USE_SIMPLE_LIBDYNTYPE 0)
endif ()

set (CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fdata-sections -ffunction-sections -Wformat")

if (NOT "${WAMR_BUILD_PLATFORM}" STREQUAL "darwin")
    set (CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Werror")
    set (CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -Wl,--gc-sections")
endif()

if (USE_SANITIZER EQUAL 1)
    message("Sanitizer enabled")
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=signed-integer-overflow  \
                        -fsanitize=undefined -fsanitize=address  \
                        -fno-sanitize=bounds,bounds-strict,alignment \
                        -fno-sanitize-recover -Wall -Werror -Wformat")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=signed-integer-overflow  \
                        -fsanitize=undefined -fsanitize=address  \
                        -fno-sanitize=bounds,bounds-strict,alignment \
                        -fno-sanitize-recover -Wall -Werror -Wformat")
endif ()

## WAMR
include(${CMAKE_CURRENT_LIST_DIR}/wamr_config.cmake)
add_library(vmlib ${WAMR_RUNTIME_LIB_SOURCE})

## quickjs
if (NOT USE_SIMPLE_LIBDYNTYPE EQUAL 1)
    set(QUICKJS_SRC_DIR ${CMAKE_CURRENT_LIST_DIR}/deps/quickjs)

    include_directories(${QUICKJS_SRC_DIR})

    set(QUICKJS_SOURCE
        ${QUICKJS_SRC_DIR}/cutils.c
        ${QUICKJS_SRC_DIR}/libregexp.c
        ${QUICKJS_SRC_DIR}/libunicode.c
        ${QUICKJS_SRC_DIR}/quickjs.c)

    # Ignore warnings of QuickJS
    set_source_files_properties(
        ${QUICKJS_SOURCE}
        PROPERTIES
        COMPILE_FLAGS "-w"
    )
endif ()

## libdyntype
set(LIBDYNTYPE_DIR ${CMAKE_CURRENT_LIST_DIR}/libdyntype)
include (${LIBDYNTYPE_DIR}/libdyntype.cmake)

## stdlib
set(STDLIB_DIR ${CMAKE_CURRENT_LIST_DIR}/stdlib)

include_directories(${STDLIB_DIR})

set(STDLIB_SOURCE
    ${STDLIB_DIR}/lib_console.c
    ${STDLIB_DIR}/lib_array.c
    ${STDLIB_DIR}/lib_timer.c
)

## struct-indirect
set(STRUCT_INDIRECT_DIR ${CMAKE_CURRENT_LIST_DIR}/struct-indirect)

include_directories(${STRUCT_INDIRECT_DIR})

set(STRUCT_INDIRECT_SOURCE
    ${STRUCT_INDIRECT_DIR}/lib_struct_indirect.c
)

## utils
set(UTILS_DIR ${CMAKE_CURRENT_LIST_DIR}/utils)

include_directories(${UTILS_DIR})

set(TYPE_UTILS_SOURCE
    ${UTILS_DIR}/type_utils.c
)

set(OBJECT_UTILS_SOURCE
    ${UTILS_DIR}/object_utils.c
)

set(WAMR_UTILS_SOURCE
    ${UTILS_DIR}/wamr_utils.c
)

include (${SHARED_DIR}/utils/uncommon/shared_uncommon.cmake)
add_executable(iwasm_gc main.c
    ${UNCOMMON_SHARED_SOURCE}
    ${QUICKJS_SOURCE}
    ${LIBDYNTYPE_SRC}
    ${STDLIB_SOURCE}
    ${STRUCT_INDIRECT_SOURCE}
    ${TYPE_UTILS_SOURCE}
    ${OBJECT_UTILS_SOURCE}
    ${WAMR_UTILS_SOURCE}
)
target_link_libraries (iwasm_gc vmlib -lm -ldl -lpthread)
