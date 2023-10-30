/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "libdyntype_export.h"
#include "stringref/string_object.h"
#include <gtest/gtest.h>

class DumpValueTest : public testing::Test {
  protected:
    virtual void SetUp() {
        ctx = dyntype_context_init();
        if (ctx == NULL) {
        }
    }

    virtual void TearDown() {
        dyntype_context_destroy(ctx);
    }

    dyn_ctx_t ctx;
};

TEST_F(DumpValueTest, dump_value) {
    char const *str_values[] = { "2147483649.1", "false", "1\"123456\"", "123456" };
    char *buffer = new char[10 * 1024];

    // number
    testing::internal::CaptureStdout();
    double value = 2147483649.1;
    dyn_value_t num = dyntype_new_number(ctx, value);
    dyntype_dump_value(ctx, num);
    const std::string output1 = testing::internal::GetCapturedStdout();
    EXPECT_STREQ(output1.c_str(), str_values[0]);
    dyntype_dump_value_buffer(ctx, num, buffer, 10 * 1024);
    EXPECT_STREQ(buffer, str_values[0]);
    dyntype_release(ctx, num);

    // boolean
    testing::internal::CaptureStdout();
    dyn_value_t boolean = dyntype_new_boolean(ctx, false);
    dyntype_dump_value(ctx, boolean);
    const std::string output2 = testing::internal::GetCapturedStdout();
    EXPECT_STREQ(output2.c_str(), str_values[1]);
    dyntype_dump_value_buffer(ctx, boolean, buffer, 10 * 1024);
    EXPECT_STREQ(buffer, str_values[1]);
    dyntype_release(ctx, boolean);

    // string
    testing::internal::CaptureStdout();
    // the output contains refer_count, output like "1`123456"
#if WASM_ENABLE_STRINGREF != 0
    WASMString wasm_string = wasm_string_new_const("123456");
    dyn_value_t str = dyntype_new_string(ctx, wasm_string);
    wasm_string_destroy(wasm_string);
#else
    dyn_value_t str = dyntype_new_string(ctx, "123456", strlen("123456"));
#endif
    dyntype_dump_value(ctx, str);
    const std::string output3 = testing::internal::GetCapturedStdout();
    EXPECT_STREQ(output3.c_str(), str_values[3]);
    dyntype_dump_value_buffer(ctx, str, buffer, 10 * 1024);
    EXPECT_STREQ(buffer, str_values[2]);
    dyntype_release(ctx, str);

    delete[] buffer;
}
