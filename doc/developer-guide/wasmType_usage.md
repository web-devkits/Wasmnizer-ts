# Use wasmType in typescript
## wasmType declaration
Now we support use wasmType directly in typescript, and the types must be explicitly specified:
- `i32`
- `i64`
- `f32`
- `f64`
## wasmType usage
### For basic type
If we define the wasmtype for variables, and the right value is LiteralValue or variables with the same wasmtype, the **no cast** will be generated.
```ts
const a: i32 = 100;
-->
(i32.const 100)
```

```ts
const a: i64 = 100;
-->
(i64.const 100)
```

```ts
const a: f32 = 100;
-->
(f32.const 100)
```

```ts
const a: f64 = 100;
-->
(f64.const 100)
```

If we don't define the wasmtype explicitly, then the variable will be regard as `number` type, **one cast** will be occurs.
```ts
const a = 100 as i32;
--->
(f64.convert_i32_s
    (i32.const 100)
)
```


### For array type
The array type should be explicitly specified too.
```ts
const a: i32[] = [1, 2];
-->
a will be regarded as i32[], the elements in right value are both i32.
```
If array's type is not explicitly specified, then left value is regarded as number[], compilation error will occur.
```ts
let a1: i32 = 1;
let a2: i32 = 2;
let a = [a1, a2];
-->
a will be regarded as number[], compile will fail.
```

### For class type
Each property's wasm type should be explicitly specified.
```ts
class A {
    a: i32 = 1;
    b: i64 = 2;
    c: f32 = 3;
    d: f64 = 4;
}
-->
The properties type are i32, i64, f32, f64 type.
```
If property's type is not explicitly specified, they will be regarded as number type, and **one cast** will occur.
```ts
class A {
    a = 1 as i32;
    b = 2 as i64;
    c = 3 as f32;
    d = 4 as f64;
}
-->
The properties type are both number type, and a, b, c all will be cast to f64.
```

### For interface type
Each property's wasm type should be explicitly specified.
```ts
interface I {
    a: i32;
    b: i64;
    c: f32;
    d: f64;
}
-->
The properties type are i32, i64, f32, f64 type.
```

### For object literal type
Since object literal's properties' type can not be defined, we only provide its value, so we judge properties' type by its real value type.
```ts
const obj = {
    a: 1 as i32,
    b: 2 as i64,
    c: 3 as f32,
    d: 4 as f64,
}
-->
The properties type are i32, i64, f32, f64 type.
```

So, if we assign the obj's type to an interface type which has wasmtype, then we should ensure that the properties' value type should be wasmtype too.
```ts
interface I {
    a: i32;
    b: i64;
    c: f32;
    d: f64;
}
const obj: I = {
    a: 1 as i32,
    b: 2 as i64,
    c: 3 as f32,
    d: 4 as f64,
}
--->
compile success
```
```ts
interface I {
    a: i32;
    b: i64;
    c: f32;
    d: f64;
}
const obj: I = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
}
--->
compile fail
```

### For funtion type
The parameter's type and return type should be explicitly specified when using wasmtype.
```ts
function test(): i32 {
    return 100 as i32;
}
-->
The return type is i32
```

```ts
function test() {
    return 100 as i32;
}
-->
One cast will occur, the return type is number.
(return
    (f64.convert_i32_s
        (i32.const 100)
    )
)
```

### binary operations
If two operators with wasm type operate binary operations, they will cast to the larger type, and operate.
```ts
const a: i32 = 100;
const b: f32 = 80.75;
const c = a + b;
--->
(local.set $0
    (i32.const 100)
)
(local.set $1
    (f32.const 80.75)
)
(local.set $2
    (f64.promote_f32
        (f32.add
            (f32.convert_i32_s
                (local.get $0)
            )
            (local.get $1)
        )
    )
)
   
```