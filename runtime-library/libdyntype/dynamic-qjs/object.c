/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */
#include "quickjs-wamr.h"
#include "libdyntype_export.h"
#include "type.h"

extern JSValue *
dynamic_dup_value(JSContext *ctx, JSValue value);

/******************* builtin type compare *******************/
static inline bool
number_cmp(double lhs, double rhs, cmp_operator operator_kind)
{
    bool res = false;

    switch (operator_kind) {
        case LessThanToken:
        {
            res = lhs < rhs;
            break;
        }
        case GreaterThanToken:
        {
            res = lhs > rhs;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = lhs == rhs;
            break;
        }
        case LessThanEqualsToken:
        {
            res = lhs <= rhs;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = lhs >= rhs;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = lhs != rhs;
            break;
        }
    }

    return res;
}

static inline bool
string_cmp(const char *lhs, const char *rhs, cmp_operator operator_kind)
{
    bool res = false;
    int cmp_res = strcmp(lhs, rhs);

    switch (operator_kind) {
        case LessThanToken:
        {
            res = cmp_res < 0;
            break;
        }
        case GreaterThanToken:
        {
            res = cmp_res > 0;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = cmp_res == 0;
            break;
        }
        case LessThanEqualsToken:
        {
            res = cmp_res <= 0;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = cmp_res >= 0;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = cmp_res != 0;
            break;
        }
    }

    return res;
}

static inline bool
bool_cmp(bool lhs, bool rhs, cmp_operator operator_kind)
{
    bool res = false;

    switch (operator_kind) {
        case LessThanToken:
        {
            res = lhs < rhs;
            break;
        }
        case GreaterThanToken:
        {
            res = lhs > rhs;
            break;
        }
        case EqualsEqualsToken:
        case EqualsEqualsEqualsToken:
        {
            res = lhs == rhs;
            break;
        }
        case LessThanEqualsToken:
        {
            res = lhs <= rhs;
            break;
        }
        case GreaterThanEqualsToken:
        {
            res = lhs >= rhs;
            break;
        }
        case ExclamationEqualsToken:
        case ExclamationEqualsEqualsToken:
        {
            res = lhs != rhs;
            break;
        }
    }

    return res;
}

static inline bool
cmp_operator_has_equal_token(cmp_operator operator_kind)
{
    if (operator_kind == EqualsEqualsToken
        || operator_kind == EqualsEqualsEqualsToken
        || operator_kind == LessThanEqualsToken
        || operator_kind == GreaterThanEqualsToken) {
        return true;
    }

    return false;
}

/******************* exterf obj boxing *******************/

static dyn_type_t
quickjs_type_to_dyn_type(int quickjs_tag)
{
    switch (quickjs_tag) {
#define XX(qtag, dyntype) \
    case qtag:            \
        return dyntype;
        XX(0, DynNull);
        XX(69, DynUndefined);
        XX(73, DynObject);
        XX(71, DynBoolean);
        XX(70, DynNumber);
        XX(72, DynString);
        // XX(27, DynFunction); // TODO
        XX(74, DynSymbol);
        // XX(139, DynBigInt); // TODO
#undef XX
        default:
            return DynUnknown;
    }
    return DynUnknown;
}

static JSValue
WasmCallBackDataForJS(JSContext *ctx, JSValueConst this_obj, int argc,
                      JSValueConst *argv, int magic, JSValue *func_data)
{
    JSValue ret;
    void *vfunc = JS_GetOpaque(func_data[0], JS_CLASS_OBJECT);
    void *exec_env = JS_GetOpaque(func_data[1], JS_CLASS_OBJECT);
    dyn_ctx_t dyntype_ctx = JS_GetOpaque(func_data[2], JS_CLASS_OBJECT);
    dyn_value_t *args = NULL;
    dyn_value_t this_dyn_obj = NULL;
    uint64_t total_size;
    dyntype_callback_dispatcher_t cb_dispatcher = NULL;

    total_size = sizeof(dyn_value_t) * argc;
    args = malloc(total_size);

    if (!args) {
        return JS_NULL;
    }

    for (int i = 0; i < argc; i++) {
        args[i] = dynamic_dup_value(ctx, *(argv + i));
    }
    this_dyn_obj = dynamic_dup_value(ctx, this_obj);

    cb_dispatcher = dyntype_get_callback_dispatcher();
    if (cb_dispatcher) {
        dyn_value_t res_boxed = cb_dispatcher(
            exec_env, dyntype_ctx, vfunc, this_dyn_obj, argc, args);
        ret = *(JSValue *)(res_boxed);
        if (res_boxed != dyntype_ctx->js_undefined
            && res_boxed != dyntype_ctx->js_null) {
            js_free(dyntype_ctx->js_ctx, res_boxed);
        }
    }
    else {
        ret = JS_ThrowInternalError(
            ctx, "external callback dispatcher not registered");
    }
    if (args) {
        for (int i = 0; i < argc; i++) {
            js_free(ctx, args[i]);
        }
        free(args);
    }

    if (this_dyn_obj) {
        js_free(ctx, this_dyn_obj);
    }
    return ret;
}

static JSValue
new_function_wrapper(dyn_ctx_t ctx, void *vfunc, void *opaque)
{
    JSValue data_hold[3];
    data_hold[0] = JS_NewObject(ctx->js_ctx);
    JS_SetOpaque(data_hold[0], vfunc);
    data_hold[1] = JS_NewObject(ctx->js_ctx);
    JS_SetOpaque(data_hold[1], opaque);
    data_hold[2] = JS_NewObject(ctx->js_ctx);
    JS_SetOpaque(data_hold[2], ctx);
    JSValue func =
        JS_NewCFunctionData(ctx->js_ctx, WasmCallBackDataForJS, 0, 0, 3,
                            data_hold); // data will be dup inside qjs
    JS_FreeValue(ctx->js_ctx, data_hold[0]);
    JS_FreeValue(ctx->js_ctx, data_hold[1]);
    JS_FreeValue(ctx->js_ctx, data_hold[2]);
    return func;
}

/******************* Field access *******************/

dyn_value_t
dynamic_new_number(dyn_ctx_t ctx, double value)
{
    JSValue v = JS_NewFloat64(ctx->js_ctx, value);
    return dynamic_dup_value(ctx->js_ctx, v);
}

dyn_value_t
dynamic_new_boolean(dyn_ctx_t ctx, bool value)
{
    JSValue v = JS_NewBool(ctx->js_ctx, value);
    return dynamic_dup_value(ctx->js_ctx, v);
}

#if WASM_ENABLE_STRINGREF != 0
dyn_value_t
dynamic_new_string(dyn_ctx_t ctx, const void *stringref)
{
    JSValue js_str = JS_MKPTR(JS_TAG_STRING, (void *)stringref);
    return dynamic_dup_value(ctx->js_ctx, JS_DupValue(ctx->js_ctx, js_str));
}
#else
dyn_value_t
dynamic_new_string(dyn_ctx_t ctx, const char *str, int len)
{
    JSValue v = JS_NewStringLen(ctx->js_ctx, str, len);
    if (JS_IsException(v)) {
        return NULL;
    }
    return dynamic_dup_value(ctx->js_ctx, v);
}
#endif

dyn_value_t
dynamic_new_undefined(dyn_ctx_t ctx)
{
    return ctx->js_undefined;
}

dyn_value_t
dynamic_new_null(dyn_ctx_t ctx)
{
    return ctx->js_null;
}

dyn_value_t
dynamic_new_object(dyn_ctx_t ctx)
{
    JSValue v = JS_NewObject(ctx->js_ctx);
    if (JS_IsException(v)) {
        return NULL;
    }
    return dynamic_dup_value(ctx->js_ctx, v);
}

dyn_value_t
dynamic_parse_json(dyn_ctx_t ctx, const char *str)
{
    JSValue v = JS_ParseJSON(ctx->js_ctx, str, strlen(str), NULL);
    if (JS_IsException(v)) {
        return NULL;
    }
    return dynamic_dup_value(ctx->js_ctx, v);
}

dyn_value_t
dynamic_new_array(dyn_ctx_t ctx, int len)
{
    JSValue v = JS_NewArray(ctx->js_ctx);
    if (JS_IsException(v)) {
        return NULL;
    }

    if (len) {
        JSValue vlen = JS_NewInt32(ctx->js_ctx, len);
        set_array_length1(ctx->js_ctx, JS_VALUE_GET_OBJ(v), vlen, 0);
    }

    return dynamic_dup_value(ctx->js_ctx, v);
}

dyn_value_t
dynamic_get_global(dyn_ctx_t ctx, const char *name)
{
    JSAtom atom = find_atom(ctx->js_ctx, name);
    JSValue global_var = JS_GetGlobalVar(ctx->js_ctx, atom, true);

    if (JS_IsException(global_var)) {
        return NULL;
    }
    JS_FreeAtom(ctx->js_ctx, atom);
    return dynamic_dup_value(ctx->js_ctx, global_var);
}

dyn_value_t
dynamic_new_object_with_class(dyn_ctx_t ctx, const char *name, int argc,
                              dyn_value_t *args)
{
    JSValue obj;
    JSAtom atom = find_atom(ctx->js_ctx, name);
    JSValue global_var = JS_GetGlobalVar(ctx->js_ctx, atom, true);
    JSValue *argv = NULL;
    dyn_value_t res = NULL;
    uint64_t total_size;

    if (JS_IsException(global_var)) {
        goto end;
    }

    total_size = sizeof(JSValue) * argc;
    if (total_size > 0) {
        argv = js_malloc(ctx->js_ctx, total_size);
        if (!argv) {
            goto end;
        }
    }

    for (int i = 0; i < argc; i++) {
        argv[i] = *(JSValue *)args[i];
    }

    obj = JS_CallConstructorInternal(ctx->js_ctx, global_var, global_var, argc,
                                     argv, 0);

    res = dynamic_dup_value(ctx->js_ctx, obj);

end:
    JS_FreeAtom(ctx->js_ctx, atom);
    JS_FreeValue(ctx->js_ctx, global_var);

    if (argv) {
        js_free(ctx->js_ctx, argv);
    }

    return res;
}

dyn_value_t
dynamic_new_extref(dyn_ctx_t ctx, void *ptr, external_ref_tag tag, void *opaque)
{
    JSValue tag_v, ref_v, v;

    if (tag != ExtObj && tag != ExtFunc && tag != ExtArray) {
        return NULL;
    }

    if (tag == ExtFunc) {
        v = new_function_wrapper(ctx, ptr, opaque);
    }
    else {
        v = JS_NewObject(ctx->js_ctx);
    }

    if (JS_IsException(v)) {
        return NULL;
    }

    tag_v = JS_NewInt32(ctx->js_ctx, (int)tag);
    ref_v = JS_NewInt32(ctx->js_ctx, (int32_t)(uintptr_t)ptr);
    JS_DefinePropertyValueStr(ctx->js_ctx, v, "@tag", tag_v, 0);
    JS_DefinePropertyValueStr(ctx->js_ctx, v, "@ref", ref_v, 0);
    return dynamic_dup_value(ctx->js_ctx, v);
}

int
dynamic_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem)
{
    JSValue *obj_ptr = (JSValue *)obj;
    JSValue *elem_ptr = (JSValue *)elem;

    if (!JS_IsArray(ctx->js_ctx, *obj_ptr)) {
        return -DYNTYPE_TYPEERR;
    }
    if (index < 0) {
        return -DYNTYPE_TYPEERR;
    }

    if (JS_SetPropertyUint32(ctx->js_ctx, *obj_ptr, index,
                             JS_DupValue(ctx->js_ctx, *elem_ptr))
        < 0) {
        return -DYNTYPE_EXCEPTION;
    }

    return DYNTYPE_SUCCESS;
}

dyn_value_t
dynamic_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index)
{
    JSValue val;
    JSValue *obj_ptr = (JSValue *)obj;
    if (!JS_IsArray(ctx->js_ctx, *obj_ptr)) {
        return NULL;
    }
    if (index < 0)
        return dynamic_new_undefined(ctx);
    val = JS_GetPropertyUint32(ctx->js_ctx, *obj_ptr, index);
    if (JS_IsException(val)) {
        return NULL;
    }
    return dynamic_dup_value(ctx->js_ctx, val);
}

int
dynamic_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value)
{
    int ret;
    JSValue *val;
    JSValue *obj_ptr = (JSValue *)obj;

    if (!JS_IsObject(*obj_ptr)) {
        return -DYNTYPE_TYPEERR;
    }
    val = (JSValue *)value;
    ret = JS_SetPropertyStr(ctx->js_ctx, *obj_ptr, prop,
                            JS_DupValue(ctx->js_ctx, *val))
              ? DYNTYPE_SUCCESS
              : -DYNTYPE_EXCEPTION;
    return ret;
}

int
dynamic_define_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                        dyn_value_t desc)
{
    int res;
    JSValue *obj_ptr = (JSValue *)obj;
    JSValue *desc_ptr = (JSValue *)desc;
    JSAtom atom;

    if (!JS_IsObject(*obj_ptr)) {
        return -DYNTYPE_TYPEERR;
    }

    if (!JS_IsObject(*desc_ptr)) {
        return -DYNTYPE_TYPEERR;
    }

    atom = JS_NewAtom(ctx->js_ctx, prop);
    if (atom == JS_ATOM_NULL) {
        return -DYNTYPE_EXCEPTION;
    }
    // It will only return TRUE or EXCEPTION, because of JS_PROP_THROW flag
    res = JS_DefinePropertyDesc1(ctx->js_ctx, *obj_ptr, atom, *desc_ptr,
                                 JS_PROP_THROW);
    JS_FreeAtom(ctx->js_ctx, atom);

    return res == -1 ? -DYNTYPE_EXCEPTION : DYNTYPE_SUCCESS;
}

dyn_value_t
dynamic_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    JSValue *obj_ptr = (JSValue *)obj;
    JSValue *ptr = NULL;
    JSValue val;

    if (!JS_IsObject(*obj_ptr) && !JS_IsString(*obj_ptr)) {
        return ctx->js_undefined;
    }

    val = JS_GetPropertyStr(ctx->js_ctx, *obj_ptr, prop);
    if (JS_IsException(val)) {
        return NULL;
    }

    ptr = dynamic_dup_value(ctx->js_ctx, val);

    return ptr;
}

int
dynamic_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    int res;
    JSAtom atom;
    JSValue *obj_ptr = (JSValue *)obj;

    if (!JS_IsObject(*obj_ptr)) {
        return -DYNTYPE_TYPEERR;
    }

    atom = JS_NewAtom(ctx->js_ctx, prop);
    if (atom == JS_ATOM_NULL) {
        return -DYNTYPE_EXCEPTION;
    }
    res = JS_HasProperty(ctx->js_ctx, *obj_ptr, atom);
    JS_FreeAtom(ctx->js_ctx, atom);
    if (res == -1) {
        return -DYNTYPE_EXCEPTION;
    }
    return res == 0 ? DYNTYPE_FALSE : DYNTYPE_TRUE;
}

int
dynamic_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    JSValue *obj_ptr = (JSValue *)obj;
    JSAtom atom;

    if (dynamic_has_property(ctx, obj, prop) != DYNTYPE_TRUE) {
        return -DYNTYPE_FALSE;
    }

    atom = JS_NewAtom(ctx->js_ctx, prop);
    if (atom == JS_ATOM_NULL) {
        return -DYNTYPE_EXCEPTION;
    }

    int res = JS_DeleteProperty(ctx->js_ctx, *obj_ptr, atom, 0);
    JS_FreeAtom(ctx->js_ctx, atom);
    if (res == -1) {
        return -DYNTYPE_EXCEPTION;
    }
    return res == 0 ? DYNTYPE_FALSE : DYNTYPE_TRUE;
}

dyn_value_t
dynamic_get_keys(dyn_ctx_t ctx, dyn_value_t obj)
{
    dyn_value_t object_obj, res = NULL;

    object_obj = dyntype_get_global(ctx, "Object");
    res = dyntype_invoke(ctx, "keys", object_obj, 1, &obj);
    dyntype_release(ctx, object_obj);

    return res;
}

/******************* Runtime type checking *******************/

bool
dynamic_is_undefined(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsUndefined(*ptr);
}

bool
dynamic_is_null(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsNull(*ptr);
}

bool
dynamic_is_bool(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsBool(*ptr);
}

int
dynamic_to_bool(dyn_ctx_t ctx, dyn_value_t bool_obj, bool *pres)
{
    JSValue *ptr = (JSValue *)bool_obj;
    if (!JS_IsBool(*ptr)) {
        return -DYNTYPE_TYPEERR;
    }
    *pres = (bool)JS_ToBool(ctx->js_ctx, *ptr);
    return DYNTYPE_SUCCESS;
}

bool
dynamic_is_number(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsNumber(*ptr);
}

int
dynamic_to_number(dyn_ctx_t ctx, dyn_value_t obj, double *pres)
{
    JSValue *ptr = (JSValue *)obj;
    if (!JS_IsNumber(*ptr)) {
        return -DYNTYPE_TYPEERR;
    }
    *pres = (JS_VALUE_GET_TAG(*ptr) == JS_TAG_INT ? JS_VALUE_GET_INT(*ptr)
                                                  : JS_VALUE_GET_FLOAT64(*ptr));
    return DYNTYPE_SUCCESS;
}

bool
dynamic_is_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return JS_IsString(*ptr);
}

#if WASM_ENABLE_STRINGREF != 0
void *
dynamic_to_string(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue js_str = *(JSValue *)obj;
    JS_DupValue(ctx->js_ctx, js_str);
    return JS_VALUE_GET_PTR(js_str);
}
#endif

int
dynamic_to_cstring(dyn_ctx_t ctx, dyn_value_t str_obj, char **pres)
{
    JSValue *ptr = (JSValue *)str_obj;
    *pres = (char *)JS_ToCString(ctx->js_ctx, *ptr);
    if (*pres == NULL) {
        return -DYNTYPE_EXCEPTION;
    }
    return DYNTYPE_SUCCESS;
}

void
dynamic_free_cstring(dyn_ctx_t ctx, char *str)
{
    JS_FreeCString(ctx->js_ctx, (const char *)str);
}

bool
dynamic_is_object(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsObject(*ptr);
}

bool
dynamic_is_function(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsFunction(ctx->js_ctx, *ptr);
}

bool
dynamic_is_array(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    return (bool)JS_IsArray(ctx->js_ctx, *ptr);
}

bool
dynamic_is_extref(dyn_ctx_t ctx, dyn_value_t obj)
{
    if (!dynamic_is_object(ctx, obj)) {
        return false;
    }
    return dynamic_has_property(ctx, obj, "@tag") == DYNTYPE_TRUE ? true
                                                                  : false;
}

int
dynamic_to_extref(dyn_ctx_t ctx, dyn_value_t obj, void **pres)
{
    JSValue *ref_v;
    JSValue *tag_v;
    int tag;

    if (dynamic_is_extref(ctx, obj) == DYNTYPE_FALSE) {
        return -DYNTYPE_TYPEERR;
    }

    tag_v = dynamic_get_property(ctx, obj, "@tag");
    ref_v = dynamic_get_property(ctx, obj, "@ref");
    *pres = (void *)(uintptr_t)JS_VALUE_GET_INT(*ref_v);

    tag = JS_VALUE_GET_INT(*tag_v);

    js_free(ctx->js_ctx, tag_v);
    js_free(ctx->js_ctx, ref_v);

    return tag;
}

bool
dynamic_is_exception(dyn_ctx_t ctx, dyn_value_t value)
{
    JSValue *ptr = (JSValue *)value;
    return (bool)JS_IsException(*ptr);
}

bool
dynamic_is_falsy(dyn_ctx_t ctx, dyn_value_t value)
{
    bool res;

    if (dynamic_is_extref(ctx, value)) {
        res = false;
    }
    else if (dynamic_is_object(ctx, value)) {
        res = false;
    }
    else if (dynamic_is_undefined(ctx, value) || dynamic_is_null(ctx, value)) {
        res = true;
    }
    else if (dynamic_is_bool(ctx, value)) {
        bool b;
        dynamic_to_bool(ctx, value, &b);
        res = !b;
    }
    else if (dynamic_is_number(ctx, value)) {
        double num;
        dynamic_to_number(ctx, value, &num);
        res = num == 0;
    }
    else if (dynamic_is_string(ctx, value)) {
        char *str;
        dynamic_to_cstring(ctx, value, &str);
        res = strcmp(str, "") == 0;
        dynamic_free_cstring(ctx, str);
    }
    else {
        res = false;
    }
    return res;
}

/******************* Type equivalence *******************/

dyn_type_t
dynamic_typeof(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValueConst *ptr = (JSValueConst *)obj;

    if (dynamic_is_extref(ctx, obj)) {
        int tag;
        void *ref;
        tag = dynamic_to_extref(ctx, obj, &ref);
        if (tag == ExtObj) {
            return DynExtRefObj;
        }
        else if (tag == ExtFunc) {
            return DynExtRefFunc;
        }
        else if (tag == ExtArray) {
            return DynExtRefArray;
        }
    }

    int q_atom_tag = js_operator_typeof1(ctx->js_ctx, *ptr);
    dyn_type_t tag = quickjs_type_to_dyn_type(q_atom_tag);
    return tag;
}

bool
dynamic_type_eq(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs)
{
    return dynamic_typeof(ctx, lhs) == dynamic_typeof(ctx, rhs);
}

bool
dynamic_cmp(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs,
            cmp_operator operator_kind)
{
    bool res;
    dyn_type_t type;

    if (lhs == rhs) {
        if (cmp_operator_has_equal_token(operator_kind)) {
            return true;
        }
        else {
            return false;
        }
    }

    type = dynamic_typeof(ctx, lhs);

    switch (type) {
        case DynBoolean:
        {
            bool lhs_b = 0, rhs_b = 0;
            dynamic_to_bool(ctx, lhs, &lhs_b);
            dynamic_to_bool(ctx, rhs, &rhs_b);
            res = bool_cmp(lhs_b, rhs_b, operator_kind);
            break;
        }
        case DynNumber:
        {
            double lhs_n = 0, rhs_n = 0;
            dynamic_to_number(ctx, lhs, &lhs_n);
            dynamic_to_number(ctx, rhs, &rhs_n);
            res = number_cmp(lhs_n, rhs_n, operator_kind);
            break;
        }
        case DynNull:
        {
            if (cmp_operator_has_equal_token(operator_kind)) {
                res = true;
            }
            else {
                res = false;
            }
            break;
        }
        case DynUndefined:
        {
            /** undefined <= undefined => false*/
            if (operator_kind == EqualsEqualsToken
                || operator_kind == EqualsEqualsEqualsToken) {
                res = true;
            }
            else {
                res = false;
            }
            break;
        }

        case DynString:
        {
            char *lhs_s, *rhs_s;
            dynamic_to_cstring(ctx, lhs, &lhs_s);
            dynamic_to_cstring(ctx, rhs, &rhs_s);
            res = string_cmp(lhs_s, rhs_s, operator_kind);
            dynamic_free_cstring(ctx, lhs_s);
            dynamic_free_cstring(ctx, rhs_s);
            break;
        }
        case DynObject:
        {
            /** only allows == / === / != / !== */
            if (operator_kind < EqualsEqualsToken) {
                printf("[runtime library error]: non-equal compare token on "
                       "two any type objects");
            }
            JSValue *lhs_v = (JSValue *)lhs;
            JSValue *rhs_v = (JSValue *)rhs;
            res = JS_VALUE_GET_PTR(*lhs_v) == JS_VALUE_GET_PTR(*rhs_v);
            if (operator_kind == ExclamationEqualsToken
                || operator_kind == ExclamationEqualsEqualsToken) {
                res = !res;
            }
            break;
        }
        default:
        {
            res = false;
        }
    }
    return res;
}

/******************* Subtyping *******************/

dyn_value_t
dynamic_new_object_with_proto(dyn_ctx_t ctx, const dyn_value_t proto_obj)
{
    JSValueConst *proto = (JSValueConst *)proto_obj;
    if (!JS_IsObject(*proto) && !JS_IsNull(*proto)) {
        return NULL;
    }
    JSValue new_obj = JS_NewObjectProto(ctx->js_ctx, *proto);
    if (JS_IsException(new_obj)) {
        return NULL;
    }
    return dynamic_dup_value(ctx->js_ctx, new_obj);
}

int
dynamic_set_prototype(dyn_ctx_t ctx, dyn_value_t obj,
                      const dyn_value_t proto_obj)
{
    JSValue *obj_ptr = (JSValue *)obj;
    if (JS_VALUE_GET_TAG(*obj_ptr) == JS_TAG_NULL
        || JS_VALUE_GET_TAG(*obj_ptr) == JS_TAG_UNDEFINED) {
        return -DYNTYPE_TYPEERR;
    }
    JSValue *proto_obj_ptr = (JSValue *)proto_obj;
    if (JS_VALUE_GET_TAG(*proto_obj_ptr) != JS_TAG_NULL
        && JS_VALUE_GET_TAG(*proto_obj_ptr) != JS_TAG_OBJECT) {
        return -DYNTYPE_TYPEERR;
    }
    int res = JS_SetPrototype(ctx->js_ctx, *obj_ptr, *proto_obj_ptr);
    return res == 1 ? DYNTYPE_SUCCESS : -DYNTYPE_EXCEPTION;
}

dyn_value_t
dynamic_get_prototype(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *obj_ptr = (JSValue *)obj;
    if (JS_VALUE_GET_TAG(*obj_ptr) == JS_TAG_NULL
        || JS_VALUE_GET_TAG(*obj_ptr) == JS_TAG_UNDEFINED) {
        return NULL;
    }
    JSValue proto = JS_GetPrototype(ctx->js_ctx, *obj_ptr);
    if (JS_IsException(proto)) {
        return NULL;
    }
    JSValue *proto1 = dynamic_dup_value(ctx->js_ctx, proto);
    return proto1;
}

dyn_value_t
dynamic_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop)
{
    JSValue *obj_ptr = (JSValue *)obj;
    if (JS_VALUE_GET_TAG(*obj_ptr) != JS_TAG_OBJECT) {
        return NULL;
    }
    JSAtom atom = JS_NewAtom(ctx->js_ctx, prop);
    if (atom == JS_ATOM_NULL) {
        return NULL;
    }
    JSPropertyDescriptor desc;
    int res = JS_GetOwnProperty(ctx->js_ctx, &desc, *obj_ptr, atom);
    JS_FreeAtom(ctx->js_ctx, atom);
    if (res != 1) {
        return NULL;
    }
    JSValue *v = dynamic_dup_value(ctx->js_ctx, desc.value);
    return v;
}

bool
dynamic_instanceof(dyn_ctx_t ctx, const dyn_value_t src_obj,
                   const dyn_value_t dst_obj)
{
    JSValue *src = (JSValue *)src_obj;
    JSValue *dst = (JSValue *)dst_obj;

    int ret = JS_OrdinaryIsInstanceOf1(ctx->js_ctx, *src, *dst);
    if (ret == -1) {
        return -DYNTYPE_EXCEPTION;
    }

    return ret == 1 ? DYNTYPE_TRUE : DYNTYPE_FALSE;
}

/******************* Dumping *******************/

void
dynamic_dump_value(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *v = (JSValue *)obj;
    const char *str;
    size_t len;

    str = JS_ToCStringLen(ctx->js_ctx, &len, *v);
    if (str) {
        if (JS_IsArray(ctx->js_ctx, *v)) {
            fwrite("[", 1, 1, stdout);
        }
        fwrite(str, 1, len, stdout);
        if (JS_IsArray(ctx->js_ctx, *v)) {
            fwrite("]", 1, 1, stdout);
        }
    }
    JS_FreeCString(ctx->js_ctx, str);
}

int
dynamic_dump_value_buffer(dyn_ctx_t ctx, dyn_value_t obj, void *buffer, int len)
{
    JSValue *v = (JSValue *)obj;
    int res = JS_DumpWithBuffer(ctx->js_rt, v, buffer, len);
    return res == -1 ? -DYNTYPE_EXCEPTION : res;
}

static dyn_value_t
dynamic_get_exception(dyn_ctx_t ctx)
{
    JSValue val = JS_GetException(ctx->js_ctx);

    return dynamic_dup_value(ctx->js_ctx, val);
}

void
dynamic_dump_error(dyn_ctx_t ctx)
{
    dyn_value_t error;
    JSValue val;
    BOOL is_error;

    error = dynamic_get_exception(ctx);
    is_error = JS_IsError(ctx->js_ctx, *(JSValue *)error);
    dynamic_dump_value(ctx, error);
    if (is_error) {
        val = JS_GetPropertyStr(ctx->js_ctx, *(JSValue *)error, "stack");
        if (!JS_IsUndefined(val)) {
            dynamic_dump_value(ctx, dynamic_dup_value(ctx->js_ctx, val));
        }
        JS_FreeValue(ctx->js_ctx, val);
    }
}

/******************* Garbage collection *******************/

dyn_value_t
dynamic_hold(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue *ptr = (JSValue *)obj;
    if (JS_VALUE_HAS_REF_COUNT(*ptr)) {
        JS_DupValue(ctx->js_ctx, *ptr);
    }

    return dynamic_dup_value(ctx->js_ctx, *ptr);
}

void
dynamic_release(dyn_ctx_t ctx, dyn_value_t obj)
{
    if (obj == NULL) {
        return;
    }

    JSValue *ptr = (JSValue *)(obj);
    JS_FreeValue(ctx->js_ctx, *ptr);
    if (obj != ctx->js_undefined && obj != ctx->js_null) {
        js_free(ctx->js_ctx, obj);
    }
}

void
dynamic_collect(dyn_ctx_t ctx)
{
    // TODO
}

/******************* Exception *******************/

dyn_value_t
dynamic_throw_exception(dyn_ctx_t ctx, dyn_value_t obj)
{
    JSValue exception_obj;
    JSValue js_exception;

    exception_obj = *(JSValue *)obj;
    js_exception = JS_Throw(ctx->js_ctx, exception_obj);

    return dynamic_dup_value(ctx->js_ctx, js_exception);
}

/******************* Special Property Access *******************/

int
dynamic_get_array_length(dyn_ctx_t ctx, dyn_value_t obj)
{
    dyn_value_t length_value = NULL;
    int length = 0;

    length_value = dynamic_get_property(ctx, obj, "length");
    if (!JS_IsNumber(*(JSValue *)length_value)) {
        return -DYNTYPE_TYPEERR;
    }
    length = JS_VALUE_GET_TAG(*(JSValue *)length_value) == JS_TAG_INT
                 ? JS_VALUE_GET_INT(*(JSValue *)length_value)
                 : -DYNTYPE_TYPEERR;
    if (length_value) {
        js_free(ctx->js_ctx, length_value);
    }

    return length;
}
