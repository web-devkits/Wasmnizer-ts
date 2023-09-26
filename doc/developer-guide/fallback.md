# ts2wasm-compiler fallback mechanism

The strategy of ts2wasm-compiler is to apply static compilation as much as possible, but there are circumstances where statization is not available, including:

1. The effort to implement static compilation for some object is relatively large, which isn't on high priority (e.g. `Map`, `Set`).
2. Accessing efficiency of some object is not critical to the application's overall performance (e.g. `Date`, `JSON`).

In this case, ts2wasm-compiler supports a `fallback` mechanism
- for scenario 1, this serves as a temporary workaround before the statical support is ready.
- for scenario 2, this will be a formal solution to bridge common used JavaScript builtin method to TypeScript application.

## Example

``` TypeScript
export function JSONTest() {
    let json = '{"result":true, "count":42}';
    // The JSON.parse and JSON.stringify are implemented by JS runtime
    let obj = JSON.parse(json);
    let str: string = JSON.stringify(obj) as string;
    console.log(obj.count);
    console.log(str);
}
```

## Fallback whitelist
- JSON object and all methods
- Map constructor and all methods
- Set constructor and all methods
- Date constructor and all methods
- Promise constructor, object and all methods

> Note: The list of objects allowed to be fallbacked is restricted by the compiler to reduce test pressure, please contact the developer team if you need more fallback objects
