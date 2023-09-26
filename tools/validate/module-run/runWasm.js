/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

const moduleName = arguments[0];

let expectedRes;
let exportFunc;
const parameters = [];

const notValidate = isNaN(Number(arguments[1]));

if (notValidate) {
    // just run a wasm module
    exportFunc = arguments[1];
    for (let i = 2; i < arguments.length; i += 2) {
        parameters.push(typeConvert(arguments[i], arguments[i + 1]));
    }
} else {
    expectedRes = typeConvert(arguments[2], arguments[3]);
    exportFunc = arguments[4];
    for (let i = 5; i < arguments.length; i += 2) {
        parameters.push(typeConvert(arguments[i], arguments[i + 1]));
    }
}

const buf = read(moduleName, 'binary');

let wasmMemory;

/** All defined but unimplemented APIs will call this function. */
function unimplemented() {
    throw Error('unimplemented');
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
        struct_get_indirect_i32: (obj, index) => {
            unimplemented();
        },
        struct_get_indirect_i64: (obj, index) => {
            unimplemented();
        },
        struct_get_indirect_f32: (obj, index) => {
            unimplemented();
        },
        struct_get_indirect_f64: (obj, index) => {
            unimplemented();
        },
        struct_get_indirect_anyref: (obj, index) => {
            unimplemented();
        },
        struct_get_indirect_funcref: (obj, index) => {
            unimplemented();
        },
        struct_set_indirect_i32: (obj, index, value) => {
            unimplemented();
        },
        struct_set_indirect_i64: (obj, index, value) => {
            unimplemented();
        },
        struct_set_indirect_f32: (obj, index, value) => {
            unimplemented();
        },
        struct_set_indirect_f64: (obj, index, value) => {
            unimplemented();
        },
        struct_set_indirect_anyref: (obj, index, value) => {
            unimplemented();
        },
        struct_set_indirect_funcref: (obj, index, value) => {
            unimplemented();
        },
    },
    libdyntype: {
        dyntype_context_init: () => BigInt(0),
        dyntype_context_destroy: (ctx) => { },
        dyntype_get_context: () => BigInt(0),
        dyntype_new_number: (ctx, value) => {
            return new Number(value);
        },
        dyntype_to_number: (ctx, value) => {
            if (!this.dyntype_is_number(ctx, value)) {
                throw Error('cast any to number failed: not a number');
            }
            const res = value.valueOf();
            return res;
        },
        dyntype_is_number: (ctx, value) => {
            return typeof value === 'number' || value instanceof Number;
        },
        dyntype_new_boolean: (ctx, value) => {
            return new Boolean(value);
        },
        dyntype_to_bool: (ctx, value) => {
            if (!this.dyntype_is_bool(ctx, value)) {
                throw Error('cast any to boolean failed:: not a boolean');
            }
            const res = value.valueOf();
            return res;
        },
        dyntype_is_bool: (ctx, value) => {
            return typeof value === 'boolean' || value instanceof Boolean;
        },
        dyntype_new_string: (ctx, value) => {
            return new String(value);
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

        dyntype_new_array: (ctx) => new Array(),
        dyntype_new_array_with_length: (ctx, len) => new Array(len),
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
            if (this.dyntype_is_extref(ctx, value)) {
                const type = this.dyntype_typeof(ctx, value);
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
            return this.dyntype_typeof(ctx, l) === this.dyntype_typeof(ctx, r);
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
        dyntype_is_null: (ctx, obj) => {
            return obj === null;
        },
        dyntype_new_null: (ctx) => null,
        dyntype_get_global: () => {},

        dyntype_new_extref: (ctx, value, flag) => {
            let ref;
            ref[REF_PROPERTY] = value;
            ref[TAG_PROPERTY] = flag;
            return ref;
        },
        dyntype_is_extref: (ctx, obj) => {
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
            if (!this.dyntype_is_extref(ctx, obj)) {
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
        dyntype_instanceof: (ctx, src, dst) => {
            // TODO
        },
        dyntype_to_string: () => {
            unimplemented();
        },
        dyntype_is_falsy: () => {
            unimplemented();
        },
        dyntype_cmp: () => {
            unimplemented();
        },
        dyntype_new_object_with_class: () => {
            throw Error('not implemented: fallback to QuickJS on JS');
        },
        dyntype_invoke: () => {
            throw Error('not implemented: fallback to QuickJS on JS');
        },
        invoke_func: () => {
            unimplemented();
        },
    },
    env: {
        console_log: (obj) => {
            /** TODO: cant log reference type variable */
            console.log(obj);
        },
        console_constructor: (obj) => {},
        strcmp(a, b) {
            let lhs = cstringToJsString(a);
            let rhs = cstringToJsString(b);
            return lhs.localeCompare(rhs);
        },
        setTimeout: (obj) => {
            unimplemented();
        },
        clearTimeout: (obj) => {
            unimplemented();
        },


        array_push_generic: (ctx, obj, elem) => {
            unimplemented();
        },
        array_pop_f64: (ctx, obj) => {
            unimplemented();
        },
        array_pop_i64: (ctx, obj) => {
            unimplemented();
        },
        array_pop_f32: (ctx, obj) => {
            unimplemented();
        },
        array_pop_i32: (ctx, obj) => {
            unimplemented();
        },
        array_pop_anyref: (ctx, obj) => {
            unimplemented();
        },
        array_concat_generic: (ctx, obj1, obj2) => {
            unimplemented();
        },
        array_reverse_generic: (ctx, obj) => {
            unimplemented();
        },
        array_shift_f64: (ctx, obj) => {
            unimplemented();
        },
        array_shift_i64: (ctx, obj) => {
            unimplemented();
        },
        array_shift_f32: (ctx, obj) => {
            unimplemented();
        },
        array_shift_i32: (ctx, obj) => {
            unimplemented();
        },
        array_shift_anyref: (ctx, obj) => {
            unimplemented();
        },
        array_slice_generic: () => {
            unimplemented();
        },
        array_join_f64: () => {
            unimplemented();
        },
        array_join_i64: () => {
            unimplemented();
        },
        array_join_f32: () => {
            unimplemented();
        },
        array_join_i32: () => {
            unimplemented();
        },
        array_join_anyref: () => {
            unimplemented();
        },
        array_find_generic: () => {
            unimplemented();
        },
        array_sort_generic: () => {
            unimplemented();
        },
        array_splice_generic: () => {
            unimplemented();
        },
        array_unshift_generic: () => {
            unimplemented();
        },
        array_indexOf_f64: () => {
            unimplemented();
        },
        array_indexOf_i64: () => {
            unimplemented();
        },
        array_indexOf_f32: () => {
            unimplemented();
        },
        array_indexOf_i32: () => {
            unimplemented();
        },
        array_indexOf_anyref: () => {
            unimplemented();
        },
        array_lastIndexOf_f64: () => {
            unimplemented();
        },
        array_lastIndexOf_i64: () => {
            unimplemented();
        },
        array_lastIndexOf_f32: () => {
            unimplemented();
        },
        array_lastIndexOf_i32: () => {
            unimplemented();
        },
        array_lastIndexOf_anyref: () => {
            unimplemented();
        },
        array_every_generic: () => {
            unimplemented();
        },
        array_some_generic: () => {
            unimplemented();
        },
        array_forEach_generic: () => {
            unimplemented();
        },
        array_map_generic: () => {
            unimplemented();
        },
        array_filter_generic: () => {
            unimplemented();
        },
        array_reduce_f64: () => {
            unimplemented();
        },
        array_reduce_i64: () => {
            unimplemented();
        },
        array_reduce_f32: () => {
            unimplemented();
        },
        array_reduce_i32: () => {
            unimplemented();
        },
        array_reduce_anyref: () => {
            unimplemented();
        },
        array_reduceRight_f64: () => {
            unimplemented();
        },
        array_reduceRight_i64: () => {
            unimplemented();
        },
        array_reduceRight_f32: () => {
            unimplemented();
        },
        array_reduceRight_i32: () => {
            unimplemented();
        },
        array_reduceRight_anyref: () => {
            unimplemented();
        },
        array_find_f64: () => {
            unimplemented();
        },
        array_find_i64: () => {
            unimplemented();
        },
        array_find_f32: () => {
            unimplemented();
        },
        array_find_i32: () => {
            unimplemented();
        },
        array_find_anyref: () => {
            unimplemented();
        },
        array_findIndex_generic: () => {
            unimplemented();
        },
        array_fill_f64: () => {
            unimplemented();
        },
        array_fill_i64: () => {
            unimplemented();
        },
        array_fill_f32: () => {
            unimplemented();
        },
        array_fill_i32: () => {
            unimplemented();
        },
        array_fill_anyref: () => {
            unimplemented();
        },
        array_copyWithin_generic: () => {
            unimplemented();
        },
        array_includes_f64: () => {
            unimplemented();
        },
        array_includes_i64: () => {
            unimplemented();
        },
        array_includes_f32: () => {
            unimplemented();
        },
        array_includes_i32: () => {
            unimplemented();
        },
        array_includes_anyref: () => {
            unimplemented();
        },
    },
};

WebAssembly.instantiate(buf, importObject).then((wasmModule) => {
    wasmMemory = wasmModule.instance.exports.default;
    const func = wasmModule.instance.exports[exportFunc];
    const res = func.call(func, ...parameters);
    if (notValidate) {
        console.log(res);
    } else {
        console.log(expectedRes == res);
    }
});

function typeConvert(type, arg) {
    switch (type) {
        case '0': {
            // boolean
            if (arg == '0') {
                return false;
            } else if (arg == '1') {
                return true;
            } else {
                console.error(`the input argument is not a boolean: ${arg}`);
            }
            break;
        }
        case '1': // number
            return parseFloat(arg);
        case '2': // string, currently not support
            return arg;
        case '3': // undefined
            return undefined;
        case '4': // null
            return null;
        default:
            console.error(
                `the input argument is not a boolean, number or string: [${type}: ${arg}]`,
            );
    }
}
