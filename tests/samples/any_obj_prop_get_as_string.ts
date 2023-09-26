/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

declare function load(path: string): any;

class Record {
  private _entry: string = '';
  init(info: any): void {
    if (info.entry) {
      let entryStr: string = info.entry as string;
    }
  }
}

class App {
  init(): void {
    let source: any = load('sourcePath');
    let record: Record = new Record();
    if (source.router) {
      record.init(source.router); 
    } 
  }
}

export function test() {
  let app = new App();
  app.init();
}