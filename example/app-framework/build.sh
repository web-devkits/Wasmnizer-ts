#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

#!/bin/bash

CURR_DIR=$PWD
WAMR_DIR=${PWD}/../../runtime-library/deps/wamr-gc
PROFILE_DIR=${PWD}/profiles
OUT_DIR=${PWD}/out
WASM_APPS=${PWD}/app
CLEAN=
CM_BUILD_TYPE="-DCMAKE_BUILD_TYPE=Release"
CM_TOOLCHAIN=""
TS2WASM_SCRIPT=${PWD}/../../build/cli/ts2wasm.js
OPT_LEVEL=3
WAMRC=${WAMR_DIR}/wamr-compiler/build/wamrc

usage ()
{
    echo "build.sh [options]"
    echo " -p [profile]"
    echo " -d [target]"
    echo " -c, rebuild SDK"
    exit 1
}


while getopts "p:dch" opt
do
    case $opt in
        p)
        PROFILE=$OPTARG
        ;;
        d)
        CM_BUILD_TYPE="-DCMAKE_BUILD_TYPE=Debug"
        ;;
        c)
        CLEAN="TRUE"
        ;;
        h)
        usage
        exit 1;
        ;;
        ?)
        echo "Unknown arg: $arg"
        usage
        exit 1
        ;;
    esac
done


if [ "$CLEAN" = "TRUE" ]; then
    rm -rf $CURR_DIR/cmake-build
fi


while  [ ! -n "$PROFILE" ]
do
    support_profiles=`ls -l "${PROFILE_DIR}" |grep '^d' | awk '{print $9}'`
    read -p "Enter build target profile (default=host-interp) -->
$support_profiles
\>:" read_platform
    if [ ! -n "$read_platform" ]; then
        PROFILE="host-interp"
    else
        PROFILE=$read_platform
    fi
done

ARG_TOOLCHAIN=""
TOOL_CHAIN_FILE=$PROFILE_DIR/$PROFILE/toolchain.cmake
if [  -f $TOOL_CHAIN_FILE ]; then
    CM_TOOLCHAIN="-DCMAKE_TOOLCHAIN_FILE=$TOOL_CHAIN_FILE"
    ARG_TOOLCHAIN="-t $TOOL_CHAIN_FILE"
    echo "toolchain file: $TOOL_CHAIN_FILE"
fi


SDK_CONFIG_FILE=$PROFILE_DIR/$PROFILE/wamr_config_wasmnizer_ts.cmake
if [ ! -f $SDK_CONFIG_FILE ]; then
    echo "SDK config file [$SDK_CONFIG_FILE] doesn't exit. quit.."
    exit 1
fi



rm -rf ${OUT_DIR}
mkdir ${OUT_DIR}
mkdir ${OUT_DIR}/wasm-apps

cd ${WAMR_DIR}/core/shared/mem-alloc

PROFILE="simple-$PROFILE"


echo "#####################build wamr sdk"
cd ${WAMR_DIR}/wamr-sdk
./build_sdk.sh -n $PROFILE -x $SDK_CONFIG_FILE $ARG_TOOLCHAIN -c
[ $? -eq 0 ] || exit $?


echo "#####################build simple project"
cd ${CURR_DIR}
mkdir -p cmake-build/$PROFILE
cd cmake-build/$PROFILE
cmake ../.. -DWAMR_BUILD_SDK_PROFILE=$PROFILE $CM_TOOLCHAIN $CM_BUILD_TYPE
make
if [ $? != 0 ];then
    echo "BUILD_FAIL simple exit as $?\n"
    exit 2
fi
cp -a simple ${OUT_DIR}
echo "#####################build simple project success"

echo -e "\n\n"
echo "#####################build host-tool"
cd ${WAMR_DIR}/test-tools/host-tool
mkdir -p bin
cd bin
cmake .. $CM_TOOLCHAIN $CM_BUILD_TYPE
make
if [ $? != 0 ];then
        echo "BUILD_FAIL host tool exit as $?\n"
        exit 2
fi
cp host_tool ${OUT_DIR}
echo "#####################build host-tool success"

echo -e "\n\n"
echo "#####################build wasm apps"

cd ${WASM_APPS}

for i in `ls *.ts`
do
APP_SRC="$i"
OUT_WASM_FILE=${i%.*}.wasm
OUT_AOT_FILE=${i%.*}.aot

node ${TS2WASM_SCRIPT} ${APP_SRC} --opt ${OPT_LEVEL} --output ${OUT_DIR}/wasm-apps/${OUT_WASM_FILE} --startSection > tmp.txt
$WAMRC --enable-gc -o ${OUT_DIR}/wasm-apps/${OUT_AOT_FILE} ${OUT_DIR}/wasm-apps/${OUT_WASM_FILE} > tmp.txt

if [ -f ${OUT_DIR}/wasm-apps/${OUT_WASM_FILE} ]; then
        echo "build ${OUT_WASM_FILE} success"
else
        echo "build ${OUT_WASM_FILE} fail"
fi

if [ -f ${OUT_DIR}/wasm-apps/${OUT_AOT_FILE} ]; then
        echo "build ${OUT_AOT_FILE} success"
else
        echo "build ${OUT_AOT_FILE} fail"
fi
done

rm tmp.txt

echo "#####################build wasm apps done"
