# ts2wasm-compiler host API mechanism

ts2wasm-compiler allows developer to expose their own native APIs to the application.

## Host implemented functions

The `declare` keyword in TypeScript is used to declare a host function. When a function is marked as `declare`, ts2wasm-compiler will generate a wasm import entry into the final wasm module

``` TypeScript
declare function native_func(x: number, msg: string): number;
```

This will generate:
``` wat
(import "env" "native_func" (func $test|native_func-declare (type $f64_ref?|$string_type|_=>_f64) (param f64 (ref null $string_type)) (result f64)))
```

In the native world, the developer should implement the native API like this:
``` C
double native_func_wrapper(wasm_exec_env_t exec_env, double x, wasm_struct_obj_t msg) {
    /* ... */
}
```

And then register this API to runtime:
``` C
REG_NATIVE_FUNC(native_func, "(Fr)F"),
```

> Please refer to [WAMR export_native_api guide](https://github.com/bytecodealliance/wasm-micro-runtime/blob/main/doc/export_native_api.md) for more details.
> Please refer to [WAMR GC API](https://github.com/bytecodealliance/wasm-micro-runtime/blob/dev/gc_refactor/core/iwasm/include/gc_export.h) to learn how to access the GC objects from native.

## Host implemented class

It's also possible to declare a whole class to be host implemented:

``` TypeScript
declare class DeclaredClass {
    grade: number;
    constructor(grade: number);
    sayHello(): void;
    static whoSayHi(name: string): number;
    get value(): any;
    set value(v: number);
}
```

This will generate:
``` wat
(import "env" "DeclaredClass_constructor" (func $test|DeclaredClass|constructor-declare (type $ref?|{}|_f64_=>_ref?|$cls-struct5|) (param (ref null ${}) f64) (result (ref null $cls-struct5))))
(import "env" "DeclaredClass_sayHello" (func $test|DeclaredClass|sayHello-declare (type $function0) (param (ref null ${}))))
(import "env" "DeclaredClass_@whoSayHi" (func $test|DeclaredClass|@whoSayHi-declare (type $ref?|$string_type|_=>_f64) (param (ref null $string_type)) (result f64)))
(import "env" "DeclaredClass_get_value" (func $test|DeclaredClass|get_value-declare (type $ref?|{}|_=>_anyref) (param (ref null ${})) (result anyref)))
(import "env" "DeclaredClass_set_value" (func $test|DeclaredClass|set_value-declare (type $ref?|{}|_anyref_=>_none) (param (ref null ${}) anyref)))
```

The native implementation is similar to function, but remember that instance methods' first parameter should be `this` which pointing to the class instance.

> Refer to [lib_console](../../runtime-library/stdlib/lib_console.c) as an example.

### Destructor

When creating a class instance provided by host, the lifecycle should also be managed by native. WAMR provide a `wasm_obj_set_gc_finalizer` for setting a custom finalizer function on a certain object, so the developer can set a finalizer in the constructor API, then the native resource can be freed once the corresponding wasm object is claimed.

## Naming convention

It is important to use a correct name when registering host APIs, assume the function name in ts source code is denoted as `$func`, and class name is denoted as `$cls`, then the host API should follow this naming convention:

|   category   |   import name    |
|  :----:      |   :----:         |
|   function   |    `$func`         |
| class constructor |    `$cls`_constructor   |
| instance method   |    `$cls`_`$func`        |
| static method     |    `$cls`_@`$func`       |
| getter     |    `$cls`\_get_`$func`       |
| setter     |    `$cls`\_set_`$func`       |

> Currently the import module name is always `env`, customizable module name is not supported yet because there are no existing TypeScript syntax to describe this. We may introduce some configuration entries to support this later.
