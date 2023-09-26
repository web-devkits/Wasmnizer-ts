# Wasmnizer-ts standard library

TypeScript doesn't introduce its own standard library, instead it relies on APIs provided by JavaScript engine because it is originally designed to be transpiled to JavaScript.

In `Wasmnizer-ts`, there are both static and dynamic type system
- For dynamic part, the [fallback mechanism](../developer-guide/fallback.md) allow us to re-use the standard library from external environment.
- For static part, we need to implement standard library based on static object layout.

Three methods are used to implement standard library in `Wasmnizer-ts`:
1. **native**: implement standard library in native, and expose them to wasm module through host APIs.
2. **source code**: implement standard library in TypeScript source code, and compile them with application code together.
3. **binaryen API**: implement standard library in wasm bytecode through binaryen API, and link them with application code together.

If the standard library API is implemented in `native`, then corresponding `libstd API` is required; if the standard library API is implemented in `source code` or `binaryen API`, then will be contained inside generated wasm module, and don't requre any APIs from runtime environment. Please navigate to below pages to check the API list and implementation method for every APIs.

If those APIs differ from the Core Library or Standard Library, there will be a description provided below to explain its usage.

- [console](./console.md)
- [string](./string.md)
- [array](./array.md)
- [math](./math.md)
