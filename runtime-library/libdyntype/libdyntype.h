/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __LIBDYNTYPE_H_
#define __LIBDYNTYPE_H_

#include <stdbool.h>
#include <string.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define DYNTYPE_FALSE 0
#define DYNTYPE_TRUE 1

#define DYNTYPE_SUCCESS 0
#define DYNTYPE_EXCEPTION 1
#define DYNTYPE_TYPEERR 2

struct DynTypeContext;

typedef struct DynTypeContext *dyn_ctx_t;
typedef void dyn_options_t;
typedef void *dyn_value_t;

typedef dyn_value_t (*dyntype_callback_dispatcher_t)(void *env, dyn_ctx_t ctx,
                                                     void *vfunc,
                                                     dyn_value_t this_obj,
                                                     int argc,
                                                     dyn_value_t *args);

typedef enum external_ref_tag {
    ExtObj,
    ExtFunc,
    ExtArray,
} external_ref_tag;

typedef enum dyn_type_t {
    DynUnknown,
    DynNull,
    DynUndefined,
    DynObject,
    DynBoolean,
    DynNumber,
    DynString,
    DynFunction,
    DynSymbol,
    DynBigInt,
    DynExtRefObj,
    DynExtRefFunc,
    DynExtRefArray,
} dyn_type_t;

typedef enum cmp_operator {
    LessThanToken                = 29,
    GreaterThanToken             = 31,
    LessThanEqualsToken          = 32,
    GreaterThanEqualsToken       = 33,
    EqualsEqualsToken            = 34,
    ExclamationEqualsToken       = 35,
    EqualsEqualsEqualsToken      = 36,
    ExclamationEqualsEqualsToken = 37,
} cmp_operator;

/*****************************************************************
*                                                                *
*                          Section 2                             *
*                                                                *
*              Interface exposed to application                  *
*                                                                *
*****************************************************************/

/****************** Context access *****************/

/**
 * @brief Get the global dynamic type system context
 *
 * @return dynamic type system context if success, NULL otherwise
 */
dyn_ctx_t
dyntype_get_context();

/******************* Field access *******************/
/* Creation */

/**
 * @brief Boxing a number to dynamic value
 *
 * @param ctx the dynamic type system context
 * @param value the number to be boxed
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_number(dyn_ctx_t ctx, double value);

/**
 * @brief Boxing a bool to dynamic value
 *
 * @param ctx the dynamic type system context
 * @param value the bool value to be boxed
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_boolean(dyn_ctx_t ctx, bool value);

/**
 * @brief Create a new dynamic string value with the given char* and len
 *
 * @param ctx the dynamic type system context
 * @param str the string to initialize the dynamic value
 * @param len the length of the given string
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_string(dyn_ctx_t ctx, const char *str, int len);

/**
 * @brief Create a undefined value
 *
 * @param ctx the dynamic type system context
 * @return dynamic undefined value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_undefined(dyn_ctx_t ctx);

/**
 * @brief Create a null value
 *
 * @param ctx the dynamic type system context
 * @return dynamic null value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_null(dyn_ctx_t ctx);

/**
 * @brief Create a new dynamic object without any property
 *
 * @param ctx the dynamic type system context
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_object(dyn_ctx_t ctx);

/**
 * @brief Create new object with given prototype
 *
 * @param ctx the dynamic type system context
 * @param proto_obj prototype object
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_object_with_proto(dyn_ctx_t ctx, const dyn_value_t proto_obj);

/**
 * @brief Create an object with class name
 *
 * @param ctx the dynamic type system context
 * @param name the name of class
 * @param argc the count of arguments
 * @param args the argument array
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_object_with_class(dyn_ctx_t ctx, const char *name, int argc,
                              dyn_value_t *args);

/**
 * @brief Create a new dynamic array object with array length
 *
 * @param ctx the dynamic type system context
 * @param len array length
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_array(dyn_ctx_t ctx, int len);

/**
 * @brief Boxing an external reference to a dynamic value
 *
 * @param ctx the dynamic type system context
 * @param ptr opaque pointer to external reference
 * @param tag external reference tag
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_new_extref(dyn_ctx_t ctx, void *ptr, external_ref_tag tag, void* opaque);

/**
 * @brief Set the value element of a dynamic object by index.
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param index the index of the element to be set
 * @param elem the value to be set to the element
 * @return 0: SUCCESS, -1: EXCEPTION, -2: TYPE ERROR
 */
int
dyntype_set_elem(dyn_ctx_t ctx, dyn_value_t obj, int index, dyn_value_t elem);

/**
 * @brief Get the value of a dynamic object by index.
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param index the index of the element to be get
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_get_elem(dyn_ctx_t ctx, dyn_value_t obj, int index);

/**
 * @brief Set the property of a dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @param value the value to be set to the property
 * @return 0 if success, error code otherwise
 * @retval -1:EXCEPTION, -2: TYPE ERROR
 */
int
dyntype_set_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                     dyn_value_t value);

/**
 * @brief Get the property of a dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_get_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

/**
 * @brief Get own property of the given dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @return dynamic value of the corresponding property if exists, NULL otherwise
 */
dyn_value_t
dyntype_get_own_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

/**
 * @brief Define the property of a dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @param value the value to be set to the property
 * @return 0 if success, error code otherwise
 * @retval -1: EXCEPTION, -2: TYPE ERROR
 */
int
dyntype_define_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop,
                        dyn_value_t desc);

/**
 * @brief Test if the property exists on the given object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @return TRUE if exists, FALSE if not exists, -1 if EXCEPTION
 */
int
dyntype_has_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

/**
 * @brief Delete the property of the given object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param prop property name
 * @return TRUE if success, FALSE if failed, -1 if EXCEPTION
 */
int
dyntype_delete_property(dyn_ctx_t ctx, dyn_value_t obj, const char *prop);

/******************* Runtime type checking *******************/
/* number */
bool
dyntype_is_number(dyn_ctx_t ctx, dyn_value_t obj);
int
dyntype_to_number(dyn_ctx_t ctx, dyn_value_t obj, double *pres);
/* boolean */
bool
dyntype_is_bool(dyn_ctx_t ctx, dyn_value_t obj);
int
dyntype_to_bool(dyn_ctx_t ctx, dyn_value_t bool_obj, bool *pres);
/* string */
bool
dyntype_is_string(dyn_ctx_t ctx, dyn_value_t obj);
int
dyntype_to_cstring(dyn_ctx_t ctx, dyn_value_t str_obj, char **pres);
void
dyntype_free_cstring(dyn_ctx_t ctx, char *str);
/* undefined and null */
bool
dyntype_is_undefined(dyn_ctx_t ctx, dyn_value_t obj);
bool
dyntype_is_null(dyn_ctx_t ctx, dyn_value_t obj);
/* object */
bool
dyntype_is_object(dyn_ctx_t ctx, dyn_value_t obj);
/* function */
bool
dyntype_is_function(dyn_ctx_t ctx, dyn_value_t obj);
/* array */
bool
dyntype_is_array(dyn_ctx_t ctx, dyn_value_t obj);
/* extern ref */
bool
dyntype_is_extref(dyn_ctx_t ctx, dyn_value_t obj);
/**
 * @brief Get the extern reference pointer
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param pres [OUTPUT] pointer to the result
 * @return external_ref_tag if success, negative error code otherwise
 */
int
dyntype_to_extref(dyn_ctx_t ctx, dyn_value_t obj, void **pres);

/**
 * @brief Check if a dynamic value is an exception
 *
 * @param ctx the dynamic type system context
 * @param value dynamic object
 * @return TRUE if the value is exception, FALSE otherwise
 */
bool
dyntype_is_exception(dyn_ctx_t ctx, dyn_value_t value);

/**
 * @brief Get the value of any type as a bool condition
 *
 * @param ctx the dynamic type system context
 * @param value dynamic object
 * @return TRUE if the value is falsy, FALSE otherwise
 */
bool
dyntype_is_falsy(dyn_ctx_t ctx, dyn_value_t value);

/******************* Type equivalence *******************/

/**
 * @brief Get actual type of the dynamic value
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @return type of the dynamic value
 */
dyn_type_t
dyntype_typeof(dyn_ctx_t ctx, dyn_value_t obj);

/**
 * @brief Check if two dynamic value has the same type
 *
 * @param ctx the dynamic type system context
 * @param lhs left hand operand
 * @param rhs right hand operand
 * @return true if the two dynamic values have same type (shape), false
 * otherwise
 */
bool
dyntype_type_eq(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs);

/**
 * @brief Compare two dynamic values
 *
 * @param ctx the dynamic type system context
 * @param lhs left hand operand
 * @param rhs right hand operand
 * @param operator_kind the compare operator_kind
 * @return true if the two dynamic values compares are equal, false
 * otherwise
 */
bool
dyntype_cmp(dyn_ctx_t ctx, dyn_value_t lhs, dyn_value_t rhs, cmp_operator operator_kind);

/******************* Subtyping *******************/

/**
 * @brief Set prototype of the given dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @param proto_obj the prototype object
 * @return 0 if success, error code otherwise
 * @retval -1:EXCEPTION, -2: TYPE ERROR
 */
int
dyntype_set_prototype(dyn_ctx_t ctx, dyn_value_t obj,
                      const dyn_value_t proto_obj);

/**
 * @brief Get the prototype of the given dynamic object
 *
 * @param ctx the dynamic type system context
 * @param obj dynamic object
 * @return prototype object, NULL if failed
 */
dyn_value_t
dyntype_get_prototype(dyn_ctx_t ctx, dyn_value_t obj);


/******************* property access *******************/

/**
 * @brief Check if the src object is instance of the dst object
 *
 * @param ctx the dynamic type system context
 * @param src_obj src object
 * @param dst_obj dst object
 * @return true if src object is instance of dst object, false otherwise
 */
bool
dyntype_instanceof(dyn_ctx_t ctx, const dyn_value_t src_obj,
                   const dyn_value_t dst_obj);

/******************* function fallback *******************/

/**
 * @brief invoke a dynamic typed function
 *
 * @param name the method name if invoking a method, NULL otherwise
 * @param obj if name is not NULL, obj is the this object, otherwise obj is the function object
 * @param argc the count of arguments
 * @param args the argument array
 * @return dynamic value returned by the function
 */
dyn_value_t
dyntype_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
               dyn_value_t *args);

/**
 * @brief get builtin global object by name
 *
 * @param name the name of object
 * @return dynamic value if success, NULL otherwise
 */
dyn_value_t
dyntype_get_global(dyn_ctx_t ctx, const char *name);

#ifdef __cplusplus
}
#endif

#endif /* end of  __LIBDYNTYPE_H_ */
