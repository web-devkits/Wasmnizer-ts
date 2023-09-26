# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception

#!/bin/bash

temp_folder="/tmp"
benchmark_dir=$(cd "$(dirname "$0")" && pwd)
benchmarks=$(ls $benchmark_dir)
ts2wasm_script=$benchmark_dir/../../build/cli/ts2wasm.js
iwasm_gc=$benchmark_dir/../../runtime-library/build/iwasm_gc
optimize_level=3

QJS_CMD=`which qjs`

if [ ! -z "$QJS_CMD" ]; then
    qjs="qjs"
elif [ -n "$QJS_PATH" ]; then
    qjs="$QJS_PATH"
else
    default_qjs_path=/usr/local/bin/qjs
    if [ -f "$default_qjs_path" ]; then
        qjs="$default_qjs_path"
    else
        echo "Error: QJS_PATH is not defined, and no default qjs path is provided."
        exit 1
    fi
fi

ts_times=()
js_times=()
prefixs=()

for benchmark in $benchmarks; do
    if [ -f "$benchmark" ]; then
        filename=$(basename "$benchmark")
        prefix="${filename%%.*}"
        extension="${filename##*.}"

        if [ "$prefix" = "merkletrees" ]; then
            continue;
        fi

        if [ "$extension" = "ts" ]; then
            prefixs+=($prefix)
            echo "Run $prefix benchmark by WAMR:"
            node $ts2wasm_script $benchmark_dir/$benchmark --opt ${optimize_level} --output $prefix.wasm > tmp.txt
            { time $iwasm_gc --gc-heap-size=52428800 -f main $prefix.wasm; } 2> time_output.txt
        elif [ "$extension" = "js" ]; then
            echo "Run $prefix benchmark by qjs:"
            { time $qjs $benchmark_dir/$benchmark; } 2> time_output.txt
        fi

        if [ "$extension" = "ts" ] || [ "$extension" = "js" ]; then
            time_info=$(cat time_output.txt)
            echo "$time_info"
            real_time=$(echo "$time_info" | grep "real" | awk '{print $2}')
            minutes=$(echo "$real_time" | cut -dm -f1)
            seconds=$(echo "$real_time" | cut -dm -f2 | sed 's/s//')
            total_seconds=$(bc <<< "$minutes * 60 + $seconds")
        fi

        if [ "$extension" = "ts" ]; then
            ts_times+=($total_seconds)
        elif [ "$extension" = "js" ]; then
            js_times+=($total_seconds)
        fi

        echo ""
    fi
done

rm -rf *.txt
rm -rf *.wasm
rm -rf *.wat

for ((i = 0; i < ${#ts_times[@]}; i++)); do
    ts_time=${ts_times[$i]}
    js_time=${js_times[$i]}
    ratio=$(bc -l <<< "scale=2; $ts_time / $js_time")
    formatted_result=$(printf "%.2f" "$ratio")
    echo "Time ratio for ${prefixs[$i]} benchmark (WAMR/qjs): $formatted_result"
done
