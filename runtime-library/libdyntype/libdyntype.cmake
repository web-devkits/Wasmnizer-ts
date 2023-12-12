#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

set (LIBDYNTYPE_DIR ${CMAKE_CURRENT_LIST_DIR})

include_directories (${LIBDYNTYPE_DIR})

if (NOT USE_SIMPLE_LIBDYNTYPE EQUAL 1)
    message("     * Use libdyntype implemented based on quickjs")
    include_directories(${LIBDYNTYPE_DIR}/dynamic-qjs)
    file (GLOB dynamic_impl_src
        ${LIBDYNTYPE_DIR}/dynamic-qjs/*.c
    )
else()
    message("     * Use simple libdyntype implementation")
    include_directories(${LIBDYNTYPE_DIR}/dynamic-simple)
    file (GLOB dynamic_impl_src
        ${LIBDYNTYPE_DIR}/dynamic-simple/*.c
    )
endif()

file (GLOB source_all
    ${LIBDYNTYPE_DIR}/*.c
    ${LIBDYNTYPE_DIR}/extref/*.c
    ${dynamic_impl_src}
)

set (LIBDYNTYPE_SRC ${source_all})
