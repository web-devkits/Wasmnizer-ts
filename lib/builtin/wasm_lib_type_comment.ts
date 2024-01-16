// Wasmnizer-ts: @WASMArray@ <arrayType1>, <number, Not_Packed, Mutable, Nullable>
type arrayType1 = any;
const keys_arr: arrayType1 = [];
keys_arr.push(1);
// Wasmnizer-ts: @WASMArray@ <arrayType2>, <string, Not_Packed, Mutable, Nullable>
type arrayType2 = any;
const values_arr: arrayType2 = [];
values_arr.push('hi');

// Wasmnizer-ts: @WASMStruct@ <structType1> <[arrayType1, arrayType2], [Not_Packed, Not_Packed], [Mutable, Mutable], Nullable, NULL>
type structType1 = any;
const str: structType1 = [keys_arr, values_arr];

const index = keys_arr;
