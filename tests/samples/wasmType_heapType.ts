/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

export function wasmArrayTypeWithLiteral() {
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

export function wasmArrayTypeWithNewArray() {
    const arrLen = 3;
    // Wasmnizer-ts: @WASMArray@
    type arrayType = i64[];
    const wasmArr: arrayType = new Array(arrLen);
    for (let i = 0; i < arrLen; i++) {
        wasmArr[i] = i;
    }
    for (let i = 0; i < arrLen; i++) {
        console.log(wasmArr[i]);
    }
    const wasmArr2: arrayType = new Array(8, 9);
    for (let i = 0; i < wasmArr2.length; i++) {
        console.log(wasmArr2[i]);
    }
}

export function wasmArrayTypeNested(): i64 {
    // Wasmnizer-ts: @WASMArray@
    type arrayType1 = i64[];
    const wasmArr1: arrayType1 = [1, 10];
    // Wasmnizer-ts: @WASMArray@
    type arrayType2 = arrayType1[];
    const wasmArr2: arrayType2 = [wasmArr1];
    
    return wasmArr2[0][0];
}

export function wasmArrayTypeInArray(): i64 {
    // Wasmnizer-ts: @WASMArray@
    type arrayType1 = i64[];
    const wasmArr1: arrayType1 = [1, 10];
    
    const arr: arrayType1[] = [wasmArr1];
    
    return arr[0][0];
}

export function wasmArrayTypeInObj(): i64 {
    // Wasmnizer-ts: @WASMArray@
    type arrayType1 = i64[];
    const wasmArr1: arrayType1 = [1, 10];
    
    const obj = {
        a: wasmArr1 as arrayType1
    }
    
    return obj.a[0];
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

    const value5 = struct2.length;
    console.log(value5);
}

export function wasmStructTypeNested(): i64 {
    // Wasmnizer-ts: @WASMStruct@
    type structType1 = [i64];
    const wasmStruct1: structType1 = [1];
    // Wasmnizer-ts: @WASMStruct@
    type structType2 = [structType1];
    const wasmStruct2: structType2 = [wasmStruct1];
    
    return wasmStruct2[0][0];
}

export function wasmStructTypeInArray(): i64 {
    // Wasmnizer-ts: @WASMStruct@
    type structType1 = [i64];
    const wasmStruct1: structType1 = [1];
    
    const arr: structType1[] = [wasmStruct1];
    
    return arr[0][0];
}

export function wasmStructTypeInObj(): i64 {
    // Wasmnizer-ts: @WASMStruct@
    type structType1 = [i64];
    const wasmStruct1: structType1 = [1];
    
    const obj = {
        a: wasmStruct1 as structType1
    }
    
    return obj.a[0];
}