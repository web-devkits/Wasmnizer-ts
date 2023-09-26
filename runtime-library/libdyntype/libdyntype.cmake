#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

set (LIBDYNTYPE_DIR ${CMAKE_CURRENT_LIST_DIR})

include_directories (${LIBDYNTYPE_DIR})

file (GLOB source_all
    ${LIBDYNTYPE_DIR}/*.c
    ${LIBDYNTYPE_DIR}/extref/*.c
    ${LIBDYNTYPE_DIR}/dynamic/*.c
)

set (LIBDYNTYPE_SRC ${source_all})
