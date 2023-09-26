/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

namespace ceil {
  export namespace ceil1 {
    export function namespace_func<T>(value: T) {
      console.log("call namespace function");
      return value;
    }
  }
}

export function test() {
  let number_tmp = ceil.ceil1.namespace_func(2023);
  console.log(number_tmp);

  let string_tmp = ceil.ceil1.namespace_func("hello world");
  console.log(string_tmp);
}
