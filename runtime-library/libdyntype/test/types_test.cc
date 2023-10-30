/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype_export.h"
#include "string_object.h"
#include <gtest/gtest.h>

class TypesTest : public testing::Test
{
  protected:
    virtual void SetUp()
    {
        ctx = dyntype_context_init();
        if (ctx == NULL) {
        }
    }

    virtual void TearDown() { dyntype_context_destroy(ctx); }

    dyn_ctx_t ctx;
};

TEST_F(TypesTest, is_undefined)
{
    dyn_value_t boolean = dyntype_new_boolean(ctx, false);
    EXPECT_FALSE(dyntype_is_undefined(ctx, boolean));
    dyntype_release(ctx, boolean);

    dyn_value_t number = dyntype_new_number(ctx, 0);
    EXPECT_FALSE(dyntype_is_undefined(ctx, number));
    dyntype_release(ctx, number);

    dyn_value_t obj = dyntype_new_object(ctx);
    EXPECT_FALSE(dyntype_is_undefined(ctx, obj));

    dyntype_release(ctx, obj);

    dyn_value_t undefined = dyntype_new_undefined(ctx);
    EXPECT_TRUE(dyntype_is_undefined(ctx, undefined));
}

TEST_F(TypesTest, create_number_object)
{
    double check_values[] = { -1,           0,          0x100,     0x1000,
                              0x3fffffff,   0x7ffffffe, 0x7ffffff, 0x80000000,
                              0xfffffffe,   0xffffffff, 0x10000,   0x100000,
                              2147483649.1, -5.48,      1234.0 };

    for (int i = 0; i < sizeof(check_values) / sizeof(check_values[0]); i++) {
        double raw_number = 0;
        dyn_value_t num = dyntype_new_number(ctx, check_values[i]);
        EXPECT_NE(num, nullptr);
        dyntype_dump_value(ctx, num);

        dyn_value_t prop1 = dyntype_new_boolean(ctx, false);
        dyn_value_t prop2 = dyntype_new_boolean(ctx, false);
        EXPECT_EQ(dyntype_set_property(ctx, num, "not_a_object", prop1),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_define_property(ctx, num, "not_a_object", prop2),
                  -DYNTYPE_TYPEERR);
        dyntype_release(ctx, prop1);
        dyntype_release(ctx, prop2);

        dyn_value_t prop = dyntype_get_property(ctx, num, "not_a_object");
        EXPECT_TRUE(dyntype_is_undefined(ctx, prop));
        EXPECT_EQ(dyntype_has_property(ctx, num, "not_a_object"),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_delete_property(ctx, num, "not_a_object"),
                  -DYNTYPE_FALSE);

        EXPECT_TRUE(dyntype_is_number(ctx, num));
        EXPECT_FALSE(dyntype_is_bool(ctx, num));
        EXPECT_FALSE(dyntype_is_object(ctx, num));
        EXPECT_FALSE(dyntype_is_undefined(ctx, num));
        EXPECT_FALSE(dyntype_is_null(ctx, num));
        EXPECT_FALSE(dyntype_is_string(ctx, num));
        EXPECT_FALSE(dyntype_is_array(ctx, num));
        EXPECT_FALSE(dyntype_is_extref(ctx, num));

        bool temp;
        char *temp2;
        EXPECT_EQ(dyntype_to_bool(ctx, num, &temp), -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_to_cstring(ctx, num, &temp2), DYNTYPE_SUCCESS);
        dyntype_free_cstring(ctx, temp2);

        dyntype_to_number(ctx, num, &raw_number);
        EXPECT_EQ(raw_number, check_values[i]);
        dyntype_release(ctx, num);
    }
}

TEST_F(TypesTest, create_boolean_object)
{
    bool check_values[] = { true, false, false, false, true };

    for (int i = 0; i < sizeof(check_values) / sizeof(check_values[0]); i++) {
        bool raw_value = 0;
        dyn_value_t boolean = dyntype_new_boolean(ctx, check_values[i]);
        EXPECT_NE(boolean, nullptr);
        dyn_value_t prop1 = dyntype_new_boolean(ctx, false);
        dyn_value_t prop2 = dyntype_new_boolean(ctx, false);

        EXPECT_EQ(dyntype_set_property(ctx, boolean, "not_a_object", prop1),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_define_property(ctx, boolean, "not_a_object", prop2),
                  -DYNTYPE_TYPEERR);
        dyn_value_t prop = dyntype_get_property(ctx, boolean, "not_a_object");
        EXPECT_TRUE(dyntype_is_undefined(ctx, prop));
        EXPECT_EQ(dyntype_has_property(ctx, boolean, "not_a_object"),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_delete_property(ctx, boolean, "not_a_object"),
                  -DYNTYPE_FALSE);
        EXPECT_FALSE(dyntype_is_number(ctx, boolean));
        EXPECT_TRUE(dyntype_is_bool(ctx, boolean));
        EXPECT_FALSE(dyntype_is_object(ctx, boolean));
        EXPECT_FALSE(dyntype_is_undefined(ctx, boolean));
        EXPECT_FALSE(dyntype_is_null(ctx, boolean));
        EXPECT_FALSE(dyntype_is_string(ctx, boolean));
        EXPECT_FALSE(dyntype_is_array(ctx, boolean));
        EXPECT_FALSE(dyntype_is_extref(ctx, boolean));

        double temp1;
        char *temp2;
        EXPECT_EQ(dyntype_to_number(ctx, boolean, &temp1), -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_to_cstring(ctx, boolean, &temp2), DYNTYPE_SUCCESS);

        dyntype_to_bool(ctx, boolean, &raw_value);
        EXPECT_EQ(raw_value, check_values[i]);

        dyntype_release(ctx, prop1);
        dyntype_release(ctx, prop2);
        dyntype_release(ctx, boolean);
    }
}

TEST_F(TypesTest, create_undefined)
{
    dyn_value_t undefined = dyntype_new_undefined(ctx);
    EXPECT_NE(undefined, nullptr);

    EXPECT_FALSE(dyntype_is_number(ctx, undefined));
    EXPECT_FALSE(dyntype_is_bool(ctx, undefined));
    EXPECT_FALSE(dyntype_is_object(ctx, undefined));
    EXPECT_TRUE(dyntype_is_undefined(ctx, undefined));
    EXPECT_FALSE(dyntype_is_null(ctx, undefined));
    EXPECT_FALSE(dyntype_is_string(ctx, undefined));
    EXPECT_FALSE(dyntype_is_array(ctx, undefined));
    EXPECT_FALSE(dyntype_is_extref(ctx, undefined));

    dyn_value_t prop = dyntype_new_boolean(ctx, false);
    EXPECT_EQ(dyntype_set_prototype(ctx, undefined, prop), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_get_prototype(ctx, undefined), nullptr);
    EXPECT_EQ(dyntype_get_own_property(ctx, undefined, "has not property"),
              nullptr);
    dyntype_release(ctx, prop);

    bool temp;
    double temp1;
    char *temp2;
    EXPECT_EQ(dyntype_to_bool(ctx, undefined, &temp), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_number(ctx, undefined, &temp1), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_cstring(ctx, undefined, &temp2), DYNTYPE_SUCCESS);
}

TEST_F(TypesTest, create_null)
{
    dyn_value_t null = dyntype_new_null(ctx);
    EXPECT_NE(null, nullptr);

    EXPECT_FALSE(dyntype_is_number(ctx, null));
    EXPECT_FALSE(dyntype_is_bool(ctx, null));
    EXPECT_FALSE(dyntype_is_object(ctx, null));
    EXPECT_FALSE(dyntype_is_undefined(ctx, null));
    EXPECT_TRUE(dyntype_is_null(ctx, null));
    EXPECT_FALSE(dyntype_is_string(ctx, null));
    EXPECT_FALSE(dyntype_is_array(ctx, null));
    EXPECT_FALSE(dyntype_is_extref(ctx, null));

    dyn_value_t prop = dyntype_new_boolean(ctx, false);
    EXPECT_EQ(dyntype_set_prototype(ctx, null, prop), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_get_prototype(ctx, null), nullptr);
    EXPECT_EQ(dyntype_get_own_property(ctx, null, "has not property"), nullptr);
    dyntype_release(ctx, prop);
}

TEST_F(TypesTest, create_string)
{
    char const *check_values[] = {
        "", " ", "abcd", "123456", "字符串", "@#$%^&*)(*", "terminal\0term"
    };
    char const *validate_values[] = { "",        " ",      "abcd",
                                      "123456",  "字符串", "@#$%^&*)(*",
                                      "terminal" };

    for (int i = 0; i < sizeof(check_values) / sizeof(check_values[0]); i++) {
        char *raw_value = nullptr;
#if WASM_ENABLE_STRINGREF != 0
        WASMString wasm_string = wasm_string_new_const(check_values[i]);
        dyn_value_t str = dyntype_new_string(ctx, wasm_string);
#else
        dyn_value_t str =
            dyntype_new_string(ctx, check_values[i], strlen(check_values[i]));
#endif

        dyn_value_t str_dup;
        EXPECT_NE(str, nullptr);
        dyn_value_t prop1 = dyntype_new_boolean(ctx, false);
        dyn_value_t prop2 = dyntype_new_boolean(ctx, false);

        EXPECT_EQ(dyntype_set_property(ctx, str, "not_a_object", prop1),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_define_property(ctx, str, "not_a_object", prop2),
                  -DYNTYPE_TYPEERR);
        dyntype_release(ctx, prop1);
        dyntype_release(ctx, prop2);
        dyn_value_t prop = dyntype_get_property(ctx, str, "not_a_object");
        EXPECT_TRUE(dyntype_is_undefined(ctx, prop));
        dyntype_release(ctx, prop);
        EXPECT_EQ(dyntype_has_property(ctx, str, "not_a_object"),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_delete_property(ctx, str, "not_a_object"),
                  -DYNTYPE_FALSE);
        EXPECT_FALSE(dyntype_is_number(ctx, str));
        EXPECT_FALSE(dyntype_is_bool(ctx, str));
        EXPECT_FALSE(dyntype_is_object(ctx, str));
        EXPECT_FALSE(dyntype_is_undefined(ctx, str));
        EXPECT_FALSE(dyntype_is_null(ctx, str));
        EXPECT_TRUE(dyntype_is_string(ctx, str));
        EXPECT_FALSE(dyntype_is_array(ctx, str));
        EXPECT_FALSE(dyntype_is_extref(ctx, str));
        str_dup = dyntype_hold(ctx, str);
        dyntype_release(ctx, str_dup);

        bool temp;
        double temp1;
        EXPECT_EQ(dyntype_to_bool(ctx, str, &temp), -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_to_number(ctx, str, &temp1), -DYNTYPE_TYPEERR);

        EXPECT_EQ(dyntype_to_cstring(ctx, str, &raw_value), DYNTYPE_SUCCESS);
        EXPECT_STREQ(raw_value, validate_values[i]);
        dyntype_release(ctx, str);
        dyntype_free_cstring(ctx, raw_value);

#if WASM_ENABLE_STRINGREF != 0
        wasm_string_destroy(wasm_string);
#endif
    }

    char const *str_values[] = { "",       " ",      "abc",
                                 "字符串", "123456", "@#$%^&*)(*" };
    char const *cmp_values[] = {
        "", " ", "ab", "字", "1234", "@#$%^"
    }; // length from 0 to 5, '字' have 3 chars exactly.
    for (int i = 0; i < sizeof(str_values) / sizeof(str_values[0]); i++) {
        char *raw_value = nullptr;
#if WASM_ENABLE_STRINGREF != 0
        WASMString wasm_string =
            wasm_string_new_with_encoding((void *)str_values[i], i, WTF16);
        dyn_value_t str = dyntype_new_string(ctx, wasm_string);
#else
        dyn_value_t str = dyntype_new_string(ctx, str_values[i], i);
#endif
        dyn_value_t str_dup;
        EXPECT_NE(str, nullptr);
        dyn_value_t prop1 = dyntype_new_boolean(ctx, false);
        dyn_value_t prop2 = dyntype_new_boolean(ctx, false);
        EXPECT_EQ(dyntype_set_property(ctx, str, "not_a_object", prop1),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_define_property(ctx, str, "not_a_object", prop2),
                  -DYNTYPE_TYPEERR);
        dyntype_release(ctx, prop1);
        dyntype_release(ctx, prop2);

        dyn_value_t prop = dyntype_get_property(ctx, str, "not_a_object");
        EXPECT_TRUE(dyntype_is_undefined(ctx, prop));
        dyntype_release(ctx, prop);
        EXPECT_EQ(dyntype_has_property(ctx, str, "not_a_object"),
                  -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_delete_property(ctx, str, "not_a_object"),
                  -DYNTYPE_FALSE);
        EXPECT_FALSE(dyntype_is_number(ctx, str));
        EXPECT_FALSE(dyntype_is_bool(ctx, str));
        EXPECT_FALSE(dyntype_is_object(ctx, str));
        EXPECT_FALSE(dyntype_is_undefined(ctx, str));
        EXPECT_FALSE(dyntype_is_null(ctx, str));
        EXPECT_TRUE(dyntype_is_string(ctx, str));
        EXPECT_FALSE(dyntype_is_array(ctx, str));
        EXPECT_FALSE(dyntype_is_extref(ctx, str));

        str_dup = dyntype_hold(ctx, str);
        dyntype_release(ctx, str_dup);

        bool temp;
        double temp1;
        EXPECT_EQ(dyntype_to_bool(ctx, str, &temp), -DYNTYPE_TYPEERR);
        EXPECT_EQ(dyntype_to_number(ctx, str, &temp1), -DYNTYPE_TYPEERR);

        EXPECT_EQ(dyntype_to_cstring(ctx, str, &raw_value), DYNTYPE_SUCCESS);
        EXPECT_STREQ(raw_value, cmp_values[i]);
        dyntype_release(ctx, str);
        dyntype_free_cstring(ctx, raw_value);
#if WASM_ENABLE_STRINGREF != 0
        wasm_string_destroy(wasm_string);
#endif
    }
}

TEST_F(TypesTest, create_array)
{

    dyn_value_t array = dyntype_new_array(ctx, 0);
    dyn_value_t array_dup;
    EXPECT_NE(array, nullptr);

    EXPECT_FALSE(dyntype_is_number(ctx, array));
    EXPECT_FALSE(dyntype_is_bool(ctx, array));
    EXPECT_TRUE(dyntype_is_object(ctx, array));
    EXPECT_FALSE(dyntype_is_undefined(ctx, array));
    EXPECT_FALSE(dyntype_is_null(ctx, array));
    EXPECT_FALSE(dyntype_is_string(ctx, array));
    EXPECT_TRUE(dyntype_is_array(ctx, array));
    EXPECT_FALSE(dyntype_is_extref(ctx, array));

    array_dup = dyntype_hold(ctx, array);
    dyntype_release(ctx, array_dup);

    bool temp;
    double temp1;
    char *temp2;
    EXPECT_EQ(dyntype_to_bool(ctx, array, &temp), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_number(ctx, array, &temp1), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_cstring(ctx, array, &temp2), DYNTYPE_SUCCESS);

    dyntype_release(ctx, array);
}

// TEST_F(TypesTest, create_extern_ref) {
//     int data = 123;
//     int data2 = 42;

//     dyn_value_t extobj =
//         dyntype_new_extref(ctx, (void *)(uintptr_t)data, ExtObj, NULL);
//     EXPECT_NE(extobj, nullptr);

//     dyn_value_t prop = dyntype_new_boolean(ctx, false);
//     dyn_value_t prop1 = dyntype_new_boolean(ctx, false);

//     EXPECT_EQ(dyntype_set_property(ctx, extobj, "prop",
//                                    prop),
//               DYNTYPE_SUCCESS);
//     EXPECT_EQ(dyntype_define_property(ctx, extobj, "prop1",
//                                       prop1),
//               -DYNTYPE_TYPEERR);
//     dyn_value_t get_prop = dyntype_get_property(ctx, extobj, "prop");
//     EXPECT_NE(get_prop, nullptr);
//     dyntype_release(ctx, get_prop);
//     EXPECT_EQ(dyntype_has_property(ctx, extobj, "prop"), DYNTYPE_TRUE);
//     EXPECT_EQ(dyntype_delete_property(ctx, extobj, "prop"), DYNTYPE_TRUE);

//     EXPECT_TRUE(dyntype_has_property(ctx, extobj, "@tag"));
//     EXPECT_TRUE(dyntype_has_property(ctx, extobj, "@ref"));

//     EXPECT_FALSE(dyntype_is_number(ctx, extobj));
//     EXPECT_FALSE(dyntype_is_bool(ctx, extobj));
//     EXPECT_FALSE(dyntype_is_undefined(ctx, extobj));
//     EXPECT_FALSE(dyntype_is_null(ctx, extobj));
//     EXPECT_FALSE(dyntype_is_string(ctx, extobj));
//     EXPECT_FALSE(dyntype_is_array(ctx, extobj));
//     EXPECT_TRUE(dyntype_is_object(ctx, extobj));
//     EXPECT_TRUE(dyntype_is_extref(ctx, extobj));

//     dyn_value_t extobj1 = dyntype_new_extref(ctx, (void *)(uintptr_t)data,
//                                              (external_ref_tag)(ExtArray +
//                                              1), NULL);
//     EXPECT_EQ(extobj1, nullptr);
//     dyntype_release(ctx, extobj1);

//     dyn_value_t extfunc =
//         dyntype_new_extref(ctx, (void *)(uintptr_t)data2, ExtFunc, NULL);
//     EXPECT_NE(extfunc, nullptr);

//     EXPECT_FALSE(dyntype_is_number(ctx, extfunc));
//     EXPECT_FALSE(dyntype_is_bool(ctx, extfunc));
//     EXPECT_FALSE(dyntype_is_undefined(ctx, extfunc));
//     EXPECT_FALSE(dyntype_is_null(ctx, extfunc));
//     EXPECT_FALSE(dyntype_is_string(ctx, extfunc));
//     EXPECT_FALSE(dyntype_is_array(ctx, extfunc));
//     EXPECT_TRUE(dyntype_is_object(ctx, extfunc));
//     EXPECT_TRUE(dyntype_is_extref(ctx, extfunc));
//     void *temp_obj;
//     EXPECT_NE(dyntype_to_extref(ctx, extobj, &temp_obj), -DYNTYPE_TYPEERR);
//     EXPECT_NE(dyntype_to_extref(ctx, extfunc, &temp_obj), -DYNTYPE_TYPEERR);

//     void *extref_obj = nullptr;
//     EXPECT_EQ(dyntype_to_extref(ctx, extobj, &extref_obj), ExtObj);
//     EXPECT_EQ((int)(uintptr_t)extref_obj, 123);

//     void *extref_fun = nullptr;
//     EXPECT_EQ(dyntype_to_extref(ctx, extfunc, &extref_fun), ExtFunc);
//     EXPECT_EQ((int)(uintptr_t)extref_fun, 42);

//     dyntype_release(ctx, prop);
//     dyntype_release(ctx, prop1);
//     dyntype_release(ctx, extobj);
//     dyntype_release(ctx, extfunc);
// }

TEST_F(TypesTest, create_object)
{
    dyn_value_t obj = dyntype_new_object(ctx);
    dyn_value_t obj_dup;
    EXPECT_NE(obj, nullptr);
    EXPECT_FALSE(dyntype_is_number(ctx, obj));
    EXPECT_FALSE(dyntype_is_bool(ctx, obj));
    EXPECT_TRUE(dyntype_is_object(ctx, obj));
    EXPECT_FALSE(dyntype_is_undefined(ctx, obj));
    EXPECT_FALSE(dyntype_is_null(ctx, obj));
    EXPECT_FALSE(dyntype_is_string(ctx, obj));
    EXPECT_FALSE(dyntype_is_array(ctx, obj));
    EXPECT_FALSE(dyntype_is_extref(ctx, obj));

    obj_dup = dyntype_hold(ctx, obj);
    dyntype_release(ctx, obj_dup);

    bool temp;
    double temp1;
    char *temp2;
    EXPECT_EQ(dyntype_to_bool(ctx, obj, &temp), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_number(ctx, obj, &temp1), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_cstring(ctx, obj, &temp2), DYNTYPE_SUCCESS);
    dyntype_free_cstring(ctx, temp2);

    /* Currently we need to manually release the object,
        after GC support finished, this line is not needed */
    dyntype_release(ctx, obj);
}

TEST_F(TypesTest, create_map)
{
    dyn_value_t obj = dyntype_new_object_with_class(ctx, "Map", 0, NULL);
    dyn_value_t obj1 = dyntype_new_object_with_class(ctx, "Set", 0, NULL);
    dyn_value_t obj_dup;
    EXPECT_NE(obj, nullptr);
    EXPECT_FALSE(dyntype_is_number(ctx, obj));
    EXPECT_FALSE(dyntype_is_bool(ctx, obj));
    EXPECT_TRUE(dyntype_is_object(ctx, obj));
    EXPECT_FALSE(dyntype_is_undefined(ctx, obj));
    EXPECT_FALSE(dyntype_is_null(ctx, obj));
    EXPECT_FALSE(dyntype_is_string(ctx, obj));
    EXPECT_FALSE(dyntype_is_array(ctx, obj));
    EXPECT_FALSE(dyntype_is_extref(ctx, obj));
    obj_dup = dyntype_hold(ctx, obj);
    dyntype_release(ctx, obj_dup);

    bool temp;
    double temp1;
    char *temp2;
    EXPECT_EQ(dyntype_to_bool(ctx, obj, &temp), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_number(ctx, obj, &temp1), -DYNTYPE_TYPEERR);
    EXPECT_EQ(dyntype_to_cstring(ctx, obj, &temp2), DYNTYPE_SUCCESS);
    dyntype_free_cstring(ctx, temp2);
    /* Currently we need to manually release the object,
        after GC support finished, this line is not needed */

    dyntype_release(ctx, obj);
    dyntype_release(ctx, obj1);
}

TEST_F(TypesTest, get_global_obj)
{
    const char *string = "{\"a\":12, \"b\":13}";
    dyn_value_t obj = dyntype_get_global(ctx, "JSON");
#if WASM_ENABLE_STRINGREF != 0
    WASMString wasm_string = wasm_string_new_const(string);
    dyn_value_t str = dyntype_new_string(ctx, wasm_string);
#else
    dyn_value_t str = dyntype_new_string(ctx, string, strlen(string));
#endif
    dyn_value_t ret = NULL;
    dyn_value_t argv[10];

    EXPECT_EQ(dyntype_has_property(ctx, obj, "stringify"), DYNTYPE_TRUE);
    EXPECT_EQ(dyntype_has_property(ctx, obj, "parse"), DYNTYPE_TRUE);

    argv[0] = str;
    ret = dyntype_invoke(ctx, "parse", obj, 1, argv);

    EXPECT_EQ(dyntype_has_property(ctx, ret, "a"), DYNTYPE_TRUE);
    EXPECT_EQ(dyntype_has_property(ctx, ret, "b"), DYNTYPE_TRUE);

    argv[0] = ret;
    ret = dyntype_invoke(ctx, "stringify", obj, 1, argv);

    EXPECT_EQ(dyntype_is_string(ctx, ret), DYNTYPE_TRUE);

    char *cstr = NULL;
    dyntype_to_cstring(ctx, ret, &cstr);
    EXPECT_EQ(strcmp(cstr, "{\"a\":12,\"b\":13}"), 0);

    dyntype_free_cstring(ctx, cstr);
    dyntype_release(ctx, argv[0]);
    dyntype_release(ctx, ret);
    dyntype_release(ctx, str);
    dyntype_release(ctx, obj);

#if WASM_ENABLE_STRINGREF != 0
    wasm_string_destroy(wasm_string);
#endif
}
