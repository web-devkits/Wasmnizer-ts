/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype_export.h"
#include "stringref/string_object.h"
#include <gtest/gtest.h>

class OperatorTest : public testing::Test
{
  protected:
    virtual void SetUp() { ctx = dyntype_context_init(); }

    virtual void TearDown() { dyntype_context_destroy(ctx); }

    testing::AssertionResult is_type_eq(dyn_value_t lhs, dyn_value_t rhs,
                                        uint32_t l, uint32_t r)
    {
        if (dyntype_type_eq(ctx, lhs, rhs)) {
            return testing::AssertionSuccess()
                   << "they are value1[" << l << "], value2[" << r << "]";
        }
        return testing::AssertionFailure()
               << "they are value1[" << l << "], value2[" << r << "]";
    }

    dyn_ctx_t ctx;
};

TEST_F(OperatorTest, typeof)
{
    int ext_data = 1000;

    dyn_value_t num = dyntype_new_number(ctx, 2147483649);
    dyn_value_t boolean = dyntype_new_boolean(ctx, true);
    dyn_value_t undefined = dyntype_new_undefined(ctx);
    dyn_value_t null = dyntype_new_null(ctx);
    dyn_value_t obj = dyntype_new_object(ctx);
#if WASM_ENABLE_STRINGREF != 0
    WASMString wasm_string = wasm_string_new_const("string", strlen("string"));
    dyn_value_t str = dyntype_new_string(ctx, wasm_string);
#else
    dyn_value_t str = dyntype_new_string(ctx, "string", strlen("string"));
#endif

    dyn_value_t array = dyntype_new_array(ctx, 0);
    dyn_value_t extref_obj = dyntype_new_extref(
        ctx, (void *)(uintptr_t)ext_data, external_ref_tag::ExtObj, NULL);
    dyn_value_t extref_func = dyntype_new_extref(
        ctx, (void *)(uintptr_t)ext_data, external_ref_tag::ExtFunc, NULL);

    EXPECT_EQ(dyntype_typeof(ctx, num), DynNumber);
    EXPECT_EQ(dyntype_typeof(ctx, boolean), DynBoolean);
    EXPECT_EQ(dyntype_typeof(ctx, undefined), DynUndefined);
    EXPECT_EQ(dyntype_typeof(ctx, null), DynObject);
    EXPECT_EQ(dyntype_typeof(ctx, obj), DynObject);
    EXPECT_EQ(dyntype_typeof(ctx, str), DynString);
    EXPECT_EQ(dyntype_typeof(ctx, array), DynObject);
    EXPECT_EQ(dyntype_typeof(ctx, extref_obj), DynExtRefObj);
    EXPECT_EQ(dyntype_typeof(ctx, extref_func), DynExtRefFunc);

    dyntype_release(ctx, num);
    dyntype_release(ctx, boolean);
    dyntype_release(ctx, obj);
    dyntype_release(ctx, str);
    dyntype_release(ctx, array);
    dyntype_release(ctx, extref_obj);
    dyntype_release(ctx, extref_func);

#if WASM_ENABLE_STRINGREF != 0
    wasm_string_destroy(wasm_string);
#endif
}

TEST_F(OperatorTest, type_eq)
{
    int ext_data = 1000;

#if WASM_ENABLE_STRINGREF != 0
    WASMString wasm_string1 = wasm_string_new_const("string", strlen("string"));
    WASMString wasm_string2 = wasm_string_new_const("test", strlen("test"));
#endif

    dyn_value_t value1[] = {
        dyntype_new_number(ctx, 2147483649),
        dyntype_new_boolean(ctx, true),
        dyntype_new_undefined(ctx),
#if WASM_ENABLE_STRINGREF != 0
        dyntype_new_string(ctx, wasm_string1),
#else
        dyntype_new_string(ctx, "string", strlen("string")),
#endif
        dyntype_new_extref(ctx, (void *)(uintptr_t)ext_data,
                           external_ref_tag::ExtObj, NULL),
        dyntype_new_extref(ctx, (void *)(uintptr_t)ext_data,
                           external_ref_tag::ExtFunc, NULL)
    };

    dyn_value_t value2[] = {
        dyntype_new_number(ctx, -10.00),
        dyntype_new_boolean(ctx, false),
        dyntype_new_undefined(ctx),
#if WASM_ENABLE_STRINGREF != 0
        dyntype_new_string(ctx, wasm_string2),
#else
        dyntype_new_string(ctx, "test", strlen("test")),
#endif
        dyntype_new_extref(ctx, (void *)(uintptr_t)ext_data,
                           external_ref_tag::ExtObj, NULL),
        dyntype_new_extref(ctx, (void *)(uintptr_t)ext_data,
                           external_ref_tag::ExtFunc, NULL),
        dyntype_new_null(ctx),
        dyntype_new_object(ctx),
        dyntype_new_array(ctx, 0)
    };

    // they are all object type
    dyn_value_t value3[] = { dyntype_new_null(ctx), dyntype_new_object(ctx),
                             dyntype_new_array(ctx, 0) };
    uint32_t len1 = sizeof(value1) / sizeof(dyn_value_t);
    uint32_t len2 = sizeof(value2) / sizeof(dyn_value_t);
    uint32_t len3 = sizeof(value3) / sizeof(dyn_value_t);

    for (uint32_t i = 0; i < len1; i++) {
        for (uint32_t j = 0; j < len2; j++) {
            if (i == j) {
                EXPECT_TRUE(is_type_eq(value1[i], value2[j], i, j));
                continue;
            }
            EXPECT_FALSE(is_type_eq(value1[i], value2[j], i, j));
        }
    }
    // null, arary, object types
    for (uint32_t i = 8; i < len2; i++) {
        for (uint32_t j = 8; j < len3; j++) {
            EXPECT_TRUE(is_type_eq(value2[i], value3[j], i, j));
        }
    }

    for (uint32_t i = 0; i < len1; i++) {
        if (value1[i] == dyntype_new_undefined(ctx)
            || value1[i] == dyntype_new_null(ctx)) {
            continue;
        }
        dyntype_release(ctx, value1[i]);
    }
    for (uint32_t i = 0; i < len2; i++) {
        if (value2[i] == dyntype_new_undefined(ctx)
            || value2[i] == dyntype_new_null(ctx)) {
            continue;
        }
        dyntype_release(ctx, value2[i]);
    }
    for (uint32_t i = 0; i < len3; i++) {
        if (value3[i] == dyntype_new_undefined(ctx)
            || value3[i] == dyntype_new_null(ctx)) {
            continue;
        }
        dyntype_release(ctx, value3[i]);
    }

#if WASM_ENABLE_STRINGREF != 0
    wasm_string_destroy(wasm_string1);
    wasm_string_destroy(wasm_string2);
#endif
}
