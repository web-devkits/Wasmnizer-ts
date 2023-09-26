/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */
class Base {
  static serialNumber = 0;

  constructor() {
    console.log("constructor from Base");
  }

  static say() {
    console.log(Base.serialNumber);
    console.log("Base");
  }
}

class A extends Base {
  static serialNumber = 1;
  x: number;

  constructor(x: number) {
    super();
    this.x = x;
    console.log("constructor from A");
  }
  
  log() {
    console.log('x: ', this.x);
  }

  static say() {
    console.log(A.serialNumber);
    super.say();
  }
}

class B extends A {
  static serialNumber = 2;
  y: string;

  constructor(x: number, y: string) {
    super(x);
    this.y = y;
    console.log("constructor from B");
  }
  
  log() {
    console.log('y: ', this.y);
    super.log();
  }

  static say() {
    console.log(B.serialNumber);
    super.say();
  }
}

export function test() {
  let b: B = new B(1, "hello");
  b.log();
  B.say();
}
