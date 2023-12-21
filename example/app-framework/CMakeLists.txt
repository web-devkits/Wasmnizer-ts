# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception

cmake_minimum_required (VERSION 2.9)

project (simple)

################  wamr runtime settings  ################
message(STATUS "WAMR_BUILD_SDK_PROFILE=${WAMR_BUILD_SDK_PROFILE}")

# Reset default linker flags
set (CMAKE_SHARED_LIBRARY_LINK_C_FLAGS "")
set (CMAKE_SHARED_LIBRARY_LINK_CXX_FLAGS "")

if ("$ENV{COLLECT_CODE_COVERAGE}" STREQUAL "1" OR COLLECT_CODE_COVERAGE EQUAL 1)
    set (CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fprofile-arcs -ftest-coverage")
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fprofile-arcs -ftest-coverage")
endif ()

set (RUNTIMR_DIR ${CMAKE_CURRENT_LIST_DIR}/../../runtime-library)
set (WAMR_ROOT_DIR ${RUNTIMR_DIR}/deps/wamr-gc)

## use library and headers in the SDK
link_directories(${WAMR_ROOT_DIR}/wamr-sdk/out/${WAMR_BUILD_SDK_PROFILE}/runtime-sdk/lib)
include_directories(
    ${WAMR_ROOT_DIR}/wamr-sdk/out/${WAMR_BUILD_SDK_PROFILE}/runtime-sdk/include
    ${WAMR_ROOT_DIR}/core/shared/utils
    ${WAMR_ROOT_DIR}/core/shared/platform/linux
)

################  application related  ################

include_directories(${CMAKE_CURRENT_LIST_DIR}/src)

#Note: uncomment below line to use UART mode
#add_definitions (-DCONNECTION_UART)


## wamr
# include(${CMAKE_CURRENT_LIST_DIR}/wamr_config_wasmnizer_ts.cmake)
# add_library(vmlib ${WAMR_RUNTIME_LIB_SOURCE})
set (WAMR_BUILD_PLATFORM "linux")
set (WAMR_BUILD_TARGET X86_64)
set (WAMR_BUILD_INTERP 1)
set (WAMR_BUILD_AOT 1)
set (WAMR_BUILD_JIT 0)
set (WAMR_BUILD_LIBC_BUILTIN 1)
set (WAMR_BUILD_LIBC_WASI 0)
set (WAMR_BUILD_GC 1)
set (WAMR_BUILD_GC_BINARYEN 1)
set (WAMR_BUILD_STRINGREF 1)
set (USE_SIMPLE_LIBDYNTYPE 1)

## stringref
set(STRINGREF_DIR ${RUNTIMR_DIR}/stringref)
set(WAMR_STRINGREF_IMPL_SOURCE
    ${STRINGREF_DIR}/stringref_simple.c
)

include(${RUNTIMR_DIR}/deps/wamr-gc/build-scripts/runtime_lib.cmake)

## libdyntype
set(LIBDYNTYPE_DIR ${RUNTIMR_DIR}/libdyntype)
include (${LIBDYNTYPE_DIR}/libdyntype.cmake)

## stdlib
set(STDLIB_DIR ${RUNTIMR_DIR}/stdlib)
include_directories(${STDLIB_DIR})
set(STDLIB_SOURCE
    ${STDLIB_DIR}/lib_console.c
    ${STDLIB_DIR}/lib_array.c
    ${STDLIB_DIR}/lib_timer.c
)

## struct-indirect
set(STRUCT_INDIRECT_DIR ${RUNTIMR_DIR}/struct-indirect)
include_directories(${STRUCT_INDIRECT_DIR})
set(STRUCT_INDIRECT_SOURCE
    ${STRUCT_INDIRECT_DIR}/lib_struct_indirect.c
)

## utils
set(UTILS_DIR ${RUNTIMR_DIR}/utils)
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
# Ignore warnings of QuickJS
set_source_files_properties(
    ${QUICKJS_SOURCE}
    PROPERTIES
    COMPILE_FLAGS "-w"
)

add_executable (simple src/main.c src/iwasm_main.c
    ${QUICKJS_SOURCE}   
    ${LIBDYNTYPE_SRC}
    ${STDLIB_SOURCE}
    ${STRUCT_INDIRECT_SOURCE}
    ${TYPE_UTILS_SOURCE}
    ${OBJECT_UTILS_SOURCE}
    ${WAMR_UTILS_SOURCE}
)
target_link_libraries (simple vmlib -lm -ldl -lpthread -lrt)



