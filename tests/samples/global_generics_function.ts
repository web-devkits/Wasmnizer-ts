/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

function global_func<T>(value: T) {
  console.log("call global function");
  return value;
}

export function test() {
  let number_tmp = global_func(2023);
  console.log(number_tmp);

  let string_tmp = global_func("hello world");
  console.log(string_tmp);
}
