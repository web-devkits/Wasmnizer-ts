/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import { testCompile } from '../utils/test_helper.js';

import 'mocha';
import { expect } from 'chai';
import { fstat, readdirSync } from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IGNORE_LIST = [
    "complexType_case1.ts",
    "complexType_case2.ts",
    "global_generics_function.ts",
    "inner_generics_function.ts",
    "namespace_generics_function.ts",
    "exception_custom_error.ts",
    "exception_throw_error.ts",
    "ignore_parameter_in_variable.ts"
]

const STRINGREF_LIST = [
    "obj_elem_get_and_set_forin.ts",
    "obj_elem_get_and_set.ts"
]

describe('basic_cases', function () {
    this.timeout(50000);
    readdirSync(__dirname)
        .filter((d) => {
            return d.endsWith('.ts') && !d.endsWith('.test.ts');
        })
        .forEach((f) => {
            let addTestFunc : any = it;
            if (IGNORE_LIST.includes(f)) {
                addTestFunc = it.skip;
            }

            addTestFunc(`${f}`, function () {
                expect(testCompile(path.join(__dirname, f))).eq(true);
            });
        });
});
