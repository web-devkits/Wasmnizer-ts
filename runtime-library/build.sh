#!/bin/bash

# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception

SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "$SCRIPT")

cd ${SCRIPTPATH}/deps
./download.sh
cd ${SCRIPTPATH}

mkdir -p ${SCRIPTPATH}/build && cd ${SCRIPTPATH}/build
cmake .. $*
make -j$(nproc)
