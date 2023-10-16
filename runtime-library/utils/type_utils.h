/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __TYPE_UTILS_H_
#define __TYPE_UTILS_H_

#include "gc_export.h"
#include "gc_object.h"

void
dynamic_object_finalizer(wasm_anyref_obj_t obj, void *data);

/* Convert host pointer to anyref */
#define RETURN_BOX_ANYREF(ptr, dyn_ctx)                                        \
    do {                                                                       \
        wasm_anyref_obj_t any_obj =                                            \
            (wasm_anyref_obj_t)wasm_anyref_obj_new(exec_env, ptr);             \
        if (!any_obj) {                                                        \
            wasm_runtime_set_exception(wasm_runtime_get_module_inst(exec_env), \
                                       "alloc memory failed");                 \
            return NULL;                                                       \
        }                                                                      \
        wasm_obj_set_gc_finalizer(                                             \
            exec_env, (wasm_obj_t)any_obj,                                     \
            (wasm_obj_finalizer_t)dynamic_object_finalizer, dyn_ctx);          \
        return any_obj;                                                        \
    } while (0)

#define BOX_ANYREF(ptr) wasm_anyref_obj_new(exec_env, ptr)

/* Convert anyref to host pointer */
#define UNBOX_ANYREF(anyref) \
    (dyn_value_t) wasm_anyref_obj_get_value((wasm_anyref_obj_t)anyref)

enum field_flag {
    FIELD = 0,
    METHOD = 1,
    GETTER = 2,
    SETTER = 3,
};

typedef enum ts_value_type_t {
    TS_OBJECT = 0,
    TS_NULL = 3,
    TS_INT = 5,
    TS_NUMBER = 6,
    TS_BOOLEAN = 7,
    TS_STRING = 9,
    TS_ANY = 10,
    TS_ARRAY = 16,
    TS_FUNCTION = 24,
} ts_value_type_t;

typedef struct ts_value_t {
    ts_value_type_t type;
    /**
     * Type of the ts value, if it's TS_BOOLEAN or TS_INT, value can be retrieved from of.i32,
     * if it's TS_NUMBER, value can be retrived from f64, otherwise get value from of.ref.
    */
    union {
        int32_t i32;
        double f64;
        void *ref;
    } of;

} ts_value_t;

/* whether the type is struct(struct_func) */
bool
is_ts_closure_type(wasm_module_t wasm_module, wasm_defined_type_t type);

/* whether the type is struct(array_i32) */
bool
is_ts_array_type(wasm_module_t wasm_module, wasm_defined_type_t type);

/* Helper to get common used fields */
uint32_t
get_array_length(wasm_struct_obj_t obj);

wasm_array_obj_t
get_array_ref(wasm_struct_obj_t obj);

int
get_array_capacity(wasm_struct_obj_t obj);

uint32_t
get_array_element_size(wasm_array_obj_t obj);

/* Type reflection */
int32_t
get_array_type_by_element(wasm_module_t wasm_module,
                          wasm_ref_type_t *element_ref_type, bool is_mutable,
                          wasm_array_type_t *p_array_type);

int32_t
get_array_struct_type(wasm_module_t wasm_module, int32_t array_type_idx,
                      wasm_struct_type_t *p_struct_type);

int32_t
get_closure_struct_type(wasm_module_t wasm_module,
                        wasm_struct_type_t *p_struct_type);

wasm_struct_obj_t
create_wasm_array_with_string(wasm_exec_env_t exec_env, void **ptr, uint32_t arrlen);

/* get string struct type*/
int32_t
get_string_struct_type(wasm_module_t wasm_module,
                       wasm_struct_type_t *p_struct_type);

/* get string array type*/
int32_t
get_string_array_type(wasm_module_t wasm_module,
                      wasm_array_type_t *p_array_type_t);

bool
is_ts_string_type(wasm_module_t wasm_module, wasm_defined_type_t type);

/* create wasm string from c string*/
#if WASM_ENABLE_STRINGREF != 0
wasm_stringref_obj_t
create_wasm_string(wasm_exec_env_t exec_env, const char *value);
#else
wasm_struct_obj_t
create_wasm_string(wasm_exec_env_t exec_env, const char *value);
#endif


/* combine elements of an array to an string */
void *
array_to_string(wasm_exec_env_t exec_env, void *ctx, void *obj,
                void *separator);

typedef struct WasmArrayInfo {
    wasm_array_obj_t ref;
    wasm_ref_type_t element_type;
    uint32_t lengh;
} WasmArrayInfo;

void
get_static_array_info(wasm_exec_env_t exec_env, uint32_t tbl_idx,
                      WasmArrayInfo *p_arr_info);

/* get property of a struct
 * result: -2: not a static object, -1: error: else: static object index
 */
int
get_prop_index_of_struct(wasm_exec_env_t exec_env, const char *prop,
                         wasm_obj_t *wasm_obj, wasm_ref_type_t *field_type);

/**
 * @brief Access object field through meta information
 *
 * @param obj object
 * @param field_name the specified field name
 * @param flag field flag
 * @param field_value if the field is found, it represents field value
 * @result 0: if field is found, -1: if field is not found
*/
int
get_object_field(wasm_exec_env_t exec_env,
                 wasm_obj_t obj,
                 const char *field_name,
                 enum field_flag flag,
                 ts_value_t *field_value);

/* get str from a string struct */
const char *
get_str_from_string_struct(wasm_struct_obj_t obj);

/* get str length from a string struct */
uint32_t
get_str_length_from_string_struct(wasm_struct_obj_t obj);

/**
* @brief get_array_element_type_with_index:
* @param obj: array struct obj
* @param idx: find element index
* @param val: return value pointer
* @result 1: if element is find, -1: if element is not found
*/
int
get_array_element_f64_with_index(wasm_struct_obj_t obj, uint32_t idx,
                                 double *val);
int
get_array_element_f32_with_index(wasm_struct_obj_t obj, uint32_t idx,
                                 float *val);
int
get_array_element_i64_with_index(wasm_struct_obj_t obj, uint32_t idx,
                                 uint64 *val);
int
get_array_element_i32_with_index(wasm_struct_obj_t obj, uint32_t idx,
                                 uint32_t *val);
int
get_array_element_anyref_with_index(wasm_struct_obj_t obj, uint32_t idx,
                                    void **val);

/* create wasm_array and it's element type is f64 */
wasm_struct_obj_t
create_wasm_array_with_f64(wasm_exec_env_t exec_env, void *ptr,
                           uint32_t arrlen);

/* create wasm_array and it's element type is i32 */
wasm_struct_obj_t
create_wasm_array_with_i32(wasm_exec_env_t exec_env, void *ptr,
                           uint32_t arrlen);

/**
 * @brief get meta info addr through wasm_obj_t
 * @param obj object
 * @result : meta info addr
 */
void *
get_meta_of_object(wasm_exec_env_t exec_env, wasm_obj_t obj);

/**
 * @brief get member count through meta info addr.
 * @param meta meta info addr.
 * @result : member field count.
 */
int32
get_meta_fields_count(void *meta);

/**
 * @brief get meta info and field member count through wasm_obj_t
 * @param meta meta pointer
 * @param flag field flag
 * @param index get field name through index
 * @result : return field name if call success or return NULL.
 */
const char *
get_field_name_from_meta_index(wasm_exec_env_t exec_env, void *meta,
                               enum field_flag flag, uint32_t index);

#endif /* end of __TYPE_UTILS_H_ */
