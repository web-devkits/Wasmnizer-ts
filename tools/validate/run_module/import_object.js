/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

let wasmMemory;

function setWasmMemory(value) {
    wasmMemory = value;
}

const TAG_PROPERTY = '@tag';
const REF_PROPERTY = '@ref';

const DynType = {
    DynUnknown: 0,
    DynUndefined: 1,
    DynNull: 2,
    DynObject: 3,
    DynBoolean: 4,
    DynNumber: 5,
    DynString: 6,
    DynFunction: 7,
    DynSymbol: 8,
    DynBigInt: 9,
    DynExtRefObj: 10,
    DynExtRefFunc: 11,
    DynExtRefArray: 12,
};

const ExtRefTag = {
    ExtObj: 0,
    ExtFunc: 1,
    ExtArray: 2,
};

const getDynTypeTag = (value) => {
    let res;
    const tag = value[TAG_PROPERTY];
    if (tag === ExtRefTag.ExtObj) {
        res = DynType.DynExtRefObj;
    } else if (tag === ExtRefTag.ExtFunc) {
        res = DynType.DynExtRefFunc;
    } else if (tag === ExtRefTag.ExtArray) {
        res = DynType.DynExtRefArray;
    } else {
        const type = typeof value;
        switch (type) {
            case 'number':
                res = DynType.DynNumber;
                break;
            case 'boolean':
                res = DynType.DynBoolean;
                break;
            case 'string':
                res = DynType.DynString;
                break;
            case 'function':
                res = DynType.DynFunction;
                break;
            case 'symbol':
                res = DynType.DynSymbol;
                break;
            case 'bigint':
                res = DynType.DynBigInt;
                break;
            case 'object':
                res = DynType.DynObject;
                break;
            case 'undefined':
                res = DynType.DynUndefined;
                break;
            default:
                res = DynType.DynUnknown;
                break;
        }
    }
    return res;
};

const cstringToJsString = (offset) => {
    let length = 0;
    let memory = new Uint8Array(wasmMemory.buffer);
    while (memory[offset + length] !== 0) {
        length++;
    }

    const decoder = new TextDecoder();
    const string = decoder.decode(memory.slice(offset, offset + length));

    return string;
};

const importObject = {
    libstruct_indirect: {
        struct_get_indirect_i32: (obj, index) => {},
        struct_get_indirect_i64: (obj, index) => {},
        struct_get_indirect_f32: (obj, index) => {},
        struct_get_indirect_f64: (obj, index) => {},
        struct_get_indirect_anyref: (obj, index) => {},
        struct_get_indirect_funcref: (obj, index) => {},
        struct_set_indirect_i32: (obj, index, value) => {},
        struct_set_indirect_i64: (obj, index, value) => {},
        struct_set_indirect_f32: (obj, index, value) => {},
        struct_set_indirect_f64: (obj, index, value) => {},
        struct_set_indirect_anyref: (obj, index, value) => {},
        struct_set_indirect_funcref: (obj, index, value) => {},
    },
    libdyntype: {
        dyntype_context_init: () => BigInt(0),
        dyntype_context_destroy: (ctx) => {},
        dyntype_get_context: () => BigInt(0),
        dyntype_new_number: (ctx, value) => {
            return value;
        },
        dyntype_to_number: (ctx, value) => {
            if (!importObject.libdyntype.dyntype_is_number(ctx, value)) {
                throw Error('cast any to number failed: not a number');
            }
            const res = value.valueOf();
            return res;
        },
        dyntype_is_number: (ctx, value) => {
            return typeof value === 'number' || value instanceof Number;
        },
        dyntype_new_boolean: (ctx, value) => {
            return value;
        },
        dyntype_to_bool: (ctx, value) => {
            if (!importObject.libdyntype.dyntype_is_bool(ctx, value)) {
                throw Error('cast any to boolean failed:: not a boolean');
            }
            const res = value.valueOf();
            return res;
        },
        dyntype_is_bool: (ctx, value) => {
            return typeof value === 'boolean' || value instanceof Boolean;
        },
        dyntype_new_string: (ctx, value) => {
            return value;
        },
        dyntype_to_cstring: (ctx, value) => {
            const memView = new DataView(wasmMemory.buffer);
            let res;
            memView.setInt32(res, value);
        },
        dyntype_free_cstring: (ctx, value) => {
            // no need in js
        },
        dyntype_is_string: (ctx, value) => {
            return typeof value === 'string' || value instanceof String;
        },
        dyntype_new_array: (ctx, len) => new Array(len),
        dyntype_is_array: (ctx, value) => {
            return Array.isArray(value);
        },
        dyntype_add_elem: (ctx, arr, elem) => {
            arr.push(elem);
        },
        dyntype_set_elem: (ctx, arr, idx, elem) => {
            arr[idx] = elem;
        },
        dyntype_get_elem: (ctx, arr, idx) => {
            return arr[idx];
        },
        dyntype_typeof: (ctx, value) => {
            let res;
            const tag = value[TAG_PROPERTY];
            if (tag === ExtRefTag.ExtObj || tag === ExtRefTag.ExtArray) {
                res = 'object';
            } else if (tag === ExtRefTag.ExtFunc) {
                res = 'function';
            } else {
                res = typeof value;
            }
            return res;
        },
        dyntype_typeof1: (ctx, value) => {
            const res = getDynTypeTag(value);
            return res;
        },
        dyntype_toString: (ctx, value) => {
            if (importObject.libdyntype.dyntype_is_extref(ctx, value)) {
                const type = importObject.libdyntype.dyntype_typeof(ctx, value);
                if (type == 'object') {
                    return '[object Object]';
                } else {
                    return '[wasm Function]';
                }
            } else {
                return value.toString();
            }
        },
        dyntype_type_eq: (ctx, l, r) => {
            return (
                importObject.libdyntype.dyntype_typeof(ctx, l) ===
                importObject.libdyntype.dyntype_typeof(ctx, r)
            );
        },
        dyntype_new_object: (ctx) => new Object(),
        dyntype_set_property: (ctx, obj, prop, value) => {
            obj[prop] = value;
            return true;
        },
        dyntype_get_property: (ctx, obj, prop) => {
            return obj[prop];
        },
        dyntype_has_property: (ctx, obj, prop) => {
            return prop in obj;
        },
        dyntype_delete_property: (ctx, obj, prop) => {
            delete obj[prop];
            return true;
        },
        dyntype_is_object: (ctx, obj) => {
            return typeof obj === 'object';
        },

        dyntype_is_undefined: (ctx, value) => {
            return typeof value === 'undefined';
        },
        dyntype_new_undefined: (ctx) => undefined,
        dyntype_is_null: () => {},
        dyntype_new_null: (ctx) => null,
        dyntype_get_global: () => {},

        dyntype_new_extref: (ctx, value, flag) => {
            /** TODO: ensure it's truely a external reference */
            let ref = {};
            ref[REF_PROPERTY] = value;
            ref[TAG_PROPERTY] = flag;
            return ref;
        },
        dyntype_is_extref: (ctx, obj) => {
            /** TODO: ensure it's truely a external reference */
            const tag = obj[TAG_PROPERTY];
            if (
                tag === ExtRefTag.ExtObj ||
                tag === ExtRefTag.ExtFunc ||
                tag === ExtRefTag.ExtArray
            ) {
                return true;
            }
            return false;
        },
        dyntype_to_extref: (ctx, obj) => {
            if (!importObject.libdyntype.dyntype_is_extref(ctx, obj)) {
                throw Error('cast any to extref failed: not an extref');
            }
            let res = obj[REF_PROPERTY];
            return res;
        },

        dyntype_get_prototype: (ctx, obj) => {
            return Object.getPrototypeOf(obj);
        },
        dyntype_set_prototype: (ctx, obj, proto) => {
            Object.setPrototypeOf(obj, proto);
        },
        dyntype_instanceof: () => {},
        dyntype_to_string: () => {},
        dyntype_is_falsy: () => {},
        dyntype_cmp: () => {},
        dyntype_new_object_with_class: (ctx, name, args_array) => {
            let ctor = undefined;
            const str_value = cstringToJsString(name);
            if (typeof window === 'undefined') {
                ctor = global[str_value];
            } else {
                ctor = window[str_value];
            }
            return new ctor(...args_array);
        },
        dyntype_invoke: (ctx, name, obj, args_array) => {
            let res = undefined;
            const str_value = cstringToJsString(name);
            if (str_value != '') {
                res = obj[str_value](...args_array);
            } else {
                res = obj(...args_array);
            }
            return res;
        },
        dyntype_get_keys: (ctx, obj) => {
            return Object.keys(obj);
        }
    },
    env: {
        Console_log: (obj) => {
            /** TODO: cant log reference type variable */
            console.log(obj);
        },
        Console_constructor: (obj) => {},
        strcmp(a, b) {
            let lhs = cstringToJsString(a);
            let rhs = cstringToJsString(b);
            return lhs.localeCompare(rhs);
        },
        setTimeout: (obj) => {},
        clearTimeout: (obj) => {},
        malloc: (size)=>{},
        free: (size)=>{},

        array_push_generic: (ctx, obj, elem) => {},
        array_pop_f64: (ctx, obj) => {},
        array_pop_i64: (ctx, obj) => {},
        array_pop_f32: (ctx, obj) => {},
        array_pop_i32: (ctx, obj) => {},
        array_pop_anyref: (ctx, obj) => {},
        array_concat_generic: (ctx, obj1, obj2) => {},
        array_reverse_generic: (ctx, obj) => {},
        array_shift_f64: (ctx, obj) => {},
        array_shift_i64: (ctx, obj) => {},
        array_shift_f32: (ctx, obj) => {},
        array_shift_i32: (ctx, obj) => {},
        array_shift_anyref: (ctx, obj) => {},
        array_slice_generic: () => {},
        array_join_f64: () => {},
        array_join_i64: () => {},
        array_join_f32: () => {},
        array_join_i32: () => {},
        array_join_anyref: () => {},
        array_find_generic: () => {},
        array_sort_generic: () => {},
        array_splice_generic: () => {},
        array_unshift_generic: () => {},
        array_indexOf_f64: () => {},
        array_indexOf_i64: () => {},
        array_indexOf_f32: () => {},
        array_indexOf_i32: () => {},
        array_indexOf_anyref: () => {},
        array_lastIndexOf_f64: () => {},
        array_lastIndexOf_i64: () => {},
        array_lastIndexOf_f32: () => {},
        array_lastIndexOf_i32: () => {},
        array_lastIndexOf_anyref: () => {},
        array_every_generic: () => {},
        array_some_generic: () => {},
        array_forEach_generic: () => {},
        array_map_generic: () => {},
        array_filter_generic: () => {},
        array_reduce_f64: () => {},
        array_reduce_i64: () => {},
        array_reduce_f32: () => {},
        array_reduce_i32: () => {},
        array_reduce_anyref: () => {},
        array_reduceRight_f64: () => {},
        array_reduceRight_i64: () => {},
        array_reduceRight_f32: () => {},
        array_reduceRight_i32: () => {},
        array_reduceRight_anyref: () => {},
        array_find_f64: () => {},
        array_find_i64: () => {},
        array_find_f32: () => {},
        array_find_i32: () => {},
        array_find_anyref: () => {},
        array_findIndex_generic: () => {},
        array_fill_f64: () => {},
        array_fill_i64: () => {},
        array_fill_f32: () => {},
        array_fill_i32: () => {},
        array_fill_anyref: () => {},
        array_copyWithin_generic: () => {},
        array_includes_f64: () => {},
        array_includes_i64: () => {},
        array_includes_f32: () => {},
        array_includes_i32: () => {},
        array_includes_anyref: () => {},
    },
};

export { importObject, setWasmMemory };
