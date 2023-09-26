/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

interface MathFunction {
  (x: number, y: number): number;
}

function foo(f: MathFunction): MathFunction{
  console.log(f(1,1));
  return f;
}

let add: MathFunction = (x, y) => x + y;
console.log(add(1, 2));

export function test() {
  console.log(add(1, 3));
  add = (x, y) => x * 2 + y;

  let multiple: MathFunction = (x, y) => x * y;
  console.log(multiple(2, 2));

  let f = foo(add);
  console.log(f(2,3));
}