/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function wasmArrayType() {
    // Wasmnizer-ts: @WASMArray@ <Not_Packed, Mutable, Nullable>
    type arrayType1 = string[];
    const keys_arr: arrayType1 = ['hi'];
    const value1 = keys_arr[0];
    console.log(value1);

    keys_arr[0] = 'hello';
    const value2 = keys_arr[0];
    console.log(value2);

    // Wasmnizer-ts: @WASMArray@
    type arrayType2 = i32[];
    const arr: arrayType2 = [88];
    const value3 = arr[0];
    console.log(value3);

    arr[0] = 77;
    const value4 = arr[0];
    console.log(value4);
}

export function wasmStructType() {
    // Wasmnizer-ts: @WASMArray@ <Not_Packed, Mutable, Nullable>
    type arrayType1 = f32[];
    const arr1: arrayType1 = [10];

    type arrayType2 = arrayType1;
    const arr2: arrayType2 = [20];

    // Wasmnizer-ts: @WASMStruct@ <[Not_Packed, Not_Packed], [Mutable, Mutable], Nullable, NULL>
    type structType1 = [arrayType1, i64];
    const struct: structType1 = [arr1, 99];

    const value1 = struct[0][0];
    console.log(value1);

    const value2 = struct[1];
    console.log(value2);

    // Wasmnizer-ts: @WASMStruct@
    type structType2 = [arrayType2, i32];
    const struct2: structType2 = [arr2, 33];

    const value3 = struct2[0][0];
    console.log(value3);

    const value4 = struct2[1];
    console.log(value4);
}