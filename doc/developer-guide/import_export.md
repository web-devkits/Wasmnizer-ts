# import and export

In ts2wasm-compiler, every file can import/export element from/to other files. The dependencies are resolved at compile time, any missing dependency will cause a compile error.

If no error occurs during dependency resolving, the compiler will generate a **single wasm module** for all the files.

Dynamic import is not possible yet.

## export function

``` TypeScript
export function add(x: number, y: number): number {
    return x + y;
}
```

## export class

``` TypeScript
export class A {
    x: number = 1;
    y: number = 2;
}
```

## export variable

``` TypeScript
export let x: number = 1;
```

## default export

``` TypeScript
export default function add(x: number, y: number): number {
    return x + y;
}
```

## export alias

``` TypeScript
export { add as add1, A, x };
```

## re-export

``` TypeScript
export { add as add1, A, x } from "./export";
```

> Note: re-export all is not supported

## import

``` TypeScript
import { add, A, x } from "./export";
```

## import all

``` TypeScript
import * as exp from "./export";
```

## import alias

``` TypeScript
import { add as add1, A, x } from "./export";
```

## import default

``` TypeScript
import def from "./export";
```

