#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

cmake_minimum_required(VERSION 2.8)

project(libdyntype)

set(QUICKJS_SRC_DIR ${CMAKE_CURRENT_LIST_DIR}/../deps/quickjs)
set(UTILS_DIR ${CMAKE_CURRENT_LIST_DIR}/../utils)
set(WAMR_DIR ${CMAKE_CURRENT_LIST_DIR}/../deps/wamr-gc)
set(STRUCT_INDIRECT_DIR ${CMAKE_CURRENT_LIST_DIR}/../struct-indirect)

include_directories(.)
include_directories(${QUICKJS_SRC_DIR})
include_directories(${STRUCT_INDIRECT_DIR})
include_directories(${UTILS_DIR})

include(${CMAKE_CURRENT_LIST_DIR}/../wamr_config.cmake)
add_library(vmlib ${WAMR_RUNTIME_LIB_SOURCE})

set(LIB_QUICKJS
    ${QUICKJS_SRC_DIR}/cutils.c
    ${QUICKJS_SRC_DIR}/libregexp.c
    ${QUICKJS_SRC_DIR}/libunicode.c
    ${QUICKJS_SRC_DIR}/quickjs.c)

add_library(quickjs ${LIB_QUICKJS})

set(STRUCT_INDIRECT_SOURCE
    ${STRUCT_INDIRECT_DIR}/lib_struct_indirect.c
)

set(UTILS_SOURCE
    ${UTILS_DIR}/object_utils.c
    ${UTILS_DIR}/type_utils.c
    ${UTILS_DIR}/wamr_utils.c
)
include(${CMAKE_CURRENT_LIST_DIR}/libdyntype.cmake)
add_library(dyntype
    ${LIBDYNTYPE_SRC}
    ${UTILS_SOURCE}
    ${STRUCT_INDIRECT_SOURCE}
)
target_link_libraries(dyntype quickjs vmlib)
