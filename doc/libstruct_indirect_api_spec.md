# libstruct_indirect API spec

## Overview

The `libstruct_indirect` API is used to access WasmGC struct fields through index calculated during runtime. The API is designed to be used by `ts2wasm-compiler` to support `interface` type.

These APIs are used to emulate the behaviour of the [proposed struct.get/set_indirect opcode](https://github.com/WebAssembly/gc/issues/397), if these opcodes are accepted by the proposal and supported by runtime, the `libstruct_indirect` API will no longer be required.

## Dependent status

These APIs are required by `interface` type, the absence of this set of APIs would prevent apps utilizing `interface` type from functioning correctly.

## Module name
`libstruct_indirect`

## API

- **struct_get_indirect_i32**
    - **Description**
        - Get i32 field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `i32`: the field value

- **struct_get_indirect_i64**
    - **Description**
        - Get i64 field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `i64`: the field value

- **struct_get_indirect_f32**
    - **Description**
        - Get f32 field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `f32`: the field value

- **struct_get_indirect_f64**
    - **Description**
        - Get f64 field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `f64`: the field value

- **struct_get_indirect_anyref**
    - **Description**
        - Get anyref field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `anyref`: the field value

- **struct_get_indirect_funcref**
    - **Description**
        - Get funcref field from WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
    - **Return**
        - `funcref`: the field value

- **struct_set_indirect_i32**
    - **Description**
        - Set i32 field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `i32`: field value

- **struct_set_indirect_i64**
    - **Description**
        - Set i64 field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `i64`: field value

- **struct_set_indirect_f32**
    - **Description**
        - Set f32 field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `f32`: field value

- **struct_set_indirect_f64**
    - **Description**
        - Set f64 field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `f64`: field value

- **struct_set_indirect_anyref**
    - **Description**
        - Set anyref field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `anyref`: field value

- **struct_set_indirect_funcref**
    - **Description**
        - Set funcref field of WasmGC struct
    - **Parameters**
        - `structref`: the WasmGC struct
        - `i32`: field index
        - `funcref`: field value
