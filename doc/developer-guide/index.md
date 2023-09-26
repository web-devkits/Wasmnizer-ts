# Wasmnizer-ts developer guide

TypeScript is a typed superset of JavaScript, its rich type information has been employed by numerous tools to facilitate tasks such as refactoring and linting. However, TypeScript code must be transpiled into pure JavaScript before execution, resulting in the loss of all type information.

The ts2wasm compiler works like a backend to the TypeScript Compiler (tsc), it utilize the power of WebAssembly Garbage Collection proposal (WasmGC) to perform static compilation wherever possible. It also provides some escape hatches to accommodate dynamic types. The ts2wasm-compiler now supports a strict subset of TypeScript and continuously strives to accommodate more semantics.

This document serves as an overview of the supported language features and highlights certain known limitations.

## Suggestions for reading

1. read [basic concepts](./basic_concepts.md) to understand the fundamental design principal of ts2wasm.
2. go through [feature list](./feature_list.md) to understand the supported language features.
3. jump to the detail through the link of specific feature in [feature list](./feature_list.md) if you are interested.

## Supported features

Please refer to [feature list](./feature_list.md)

It's hard to enumerate every detailed syntax in the list, please refer to our [test cases](../../tests/samples/) for more samples.
