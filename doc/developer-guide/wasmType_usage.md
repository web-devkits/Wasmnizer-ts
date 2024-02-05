# Use wasmType in typescript
## wasmType declaration
Now we support use wasmType directly in typescript, these below types are supported:
### wasm basic type
- `i32`
- `i64`
- `f32`
- `f64`
- `anyref`
### wasm heap type
- `array`
- `struct`

## wasmType usage
During usage, we must follow some rules. And the wasm basic type rules is differ from wasm heap type rules.
### wasm basic type
We can use the wasm basic type as ts type name directly.
### wasm heap type
We should set a special comment to indicate that a wasm heap type structure will be created.

1. For `array`, we use `comment + array type alias` to represent the raw wasm array type.
```ts
// Wasmnizer-ts: @WASMArray@ <Not_Packed, Mutable, Nullable>
type arrayType1 = string[];
---> will create a raw wasm array type: array<stringref>

// Wasmnizer-ts: @WASMArray@
type arrayType2 = i32[];
---> will create a raw wasm array type: array<i32>
```
**Hint: `// Wasmnizer-ts: @WASMArray@ ` is necessary, and `<Not_Packed, Mutable, Nullable>` is optional. The latter shows that `if the array element is packed`, `if the array element is mutable`, `if the array is nullable`. The default value is `Not_Packed`, `Mutable` and `Nullable`.**

2. For `struct`, we use `comment + tuple type alias` to represent the raw wasm struct type.
```ts
// Wasmnizer-ts: @WASMStruct@ <[Not_Packed, Not_Packed], [Mutable, Mutable], Nullable, NULL>
type structType1 = [arrayType1, i64];
---> will create a raw wasm struct type: struct[array<stringref>, i64]

// Wasmnizer-ts: @WASMStruct@
type structType2 = [i64, i32];
---> will create a raw wasm struct type: struct[i64, i32]
```
**Hint: `// Wasmnizer-ts: @WASMStruct@ ` is necessary, and `<[Not_Packed, ...], [Mutable, ...], Nullable, BaseTypeName>` is optional. The latter shows that `if the struct fields are packed`, `if the struct fields are mutable`, `if the struct is nullable`, `the struct's base type name`. The default value is `[Not_Packed, ...]`, `[Mutable, ...]`, `Nullable` and `NULL`.**

The comments' optional attributes can be one of these enum value:
```ts
export enum PackedTypeKind {
    Not_Packed = 'Not_Packed',
    I8 = 'I8',
    I16 = 'I16',
}

export enum MutabilityKind {
    Immutable = 'Immutable',
    Mutable = 'Mutable',
}

export enum NullabilityKind {
    NonNullable = 'NonNullable',
    Nullable = 'Nullable',
}
```

## Example
### Used as basic type
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

```ts
// Wasmnizer-ts: @WASMArray@
type arrayType2 = i32[];
const a: arrayType2 = [100];
-->
(array.new_fixed $array0 1
    (i32.const 100)
)
```

```ts
// Wasmnizer-ts: @WASMStruct@
type structType2 = [i64, i32];
const a: structType2 = [100, 200]
--->
(struct.new $45
    (i64.const 100)
    (i32.const 200)
)
```

If we don't define the wasmtype explicitly, then the variable will be regard as `number` type, **one cast** will be occurs.
```ts
const a = 100 as i32;
--->
(f64.convert_i32_s
    (i32.const 100)
)
```


### Used as array element type
The array type should be explicitly specified too.
```ts
const a: i32[] = [1, 2];
-->
a will be regarded as i32[], the elements in right value are both i32.
since we use struct to represent ts array, so the wasm structure is struct[array<i32>, i32].
```
```ts
const x: arrayType2 = [100];
const y: arrayType2 = [200];
const a: arrayType2[] = [x, y];
-->
a will be regarded as arrayType2[], the elements in right value are both arrayType2.
since we use struct to represent ts array, so the wasm structure is struct[array<array<i32>>, i32].
```
If array's type is not explicitly specified, then left value is regarded as number[], compilation error will occur.
```ts
let a1: i32 = 1;
let a2: i32 = 2;
let a = [a1, a2];
-->
a will be regarded as number[], compile will fail.
```

### Used as class property type
Each property's wasm type should be explicitly specified.
```ts
class A {
    a: i32 = 1;
    b: i64 = 2;
    c: f32 = 3;
    d: f64 = 4;
    e: arrayType2 = [5];
}
-->
The properties type are i32, i64, f32, f64, array<i32> type.
```
If property's type is not explicitly specified, they will be regarded as original ts type, and **one cast** will occur.
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
Wasm heap type can not be used as casted target since the ts original type `number[]` can not be casted to `WASMArrayType`:
```ts
class A {
    e = [5] as arrayType2
}
-->
Will cause compilation error since `cannot make cast value from "Array<NUMBER(6)(OBJECT)>(-1)" to  "WASM_ARRAY(58)"`
```

### Used as interface property type
Each property's wasm type should be explicitly specified.
```ts
interface I {
    a: i32;
    b: i64;
    c: f32;
    d: f64;
    e: arrayType2;
}
-->
The properties type are i32, i64, f32, f64, array<i32> type.
```

### Used as object literal property type
Since object literal's properties' type can not be defined, we only provide its value, so we judge properties' type by its real value type.
```ts
const x: arrayType2 = [5];
const obj = {
    a: 1 as i32,
    b: 2 as i64,
    c: 3 as f32,
    d: 4 as f64,
    e: x as arrayType2,
}
-->
The properties type are i32, i64, f32, f64, array<i32> type.
```

So, if we assign the obj's type to an interface type which has wasmtype, then we should ensure that the properties' value type should be wasmtype too.
```ts
interface I {
    a: i32;
    b: i64;
    c: f32;
    d: f64;
    e: arrayType2;
}
const x: arrayType2 = [5];
const obj: I = {
    a: 1 as i32,
    b: 2 as i64,
    c: 3 as f32,
    d: 4 as f64,
    e: x as arrayType2,
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
    e: arrayType2;
}
const obj: I = {
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: [5],
}
--->
compile fail
```

### Used as funtion param type & return type
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

```ts
function test(): arrayType2 {
    const x: arrayType2 = [100];
    return x;
}
-->
The return type is array<i32>.
```

### type casting in binary operations
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