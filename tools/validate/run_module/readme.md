# Run generated WASM module

This document describes how to execute WASM module on node.js and on chrome.

> Note: Wasmnizer-ts follows the latest WasmGC spec, which requires `V8 v11.9+`, but the latest nodejs (v21.5.0) is using `V8 11.8.172.17`, so currently the generated WASM module can't execute on any nodejs releases.

> If you do want to try on nodejs, you can reset to commit `94cf9929421d47a9976fa6edf74b25ef2a00ee12` to build the compiler, which is compatible to older V8 versions.

## Run module on node

### Prerequisites
   - node.js version 20.0.0 or higher

     to enable support for `stringref` feature, node.js version 20.0 or higher is necessary.

   - required flags in Node.js

     - `--experimental-wasm-gc`: This flag is required to enable support for the WASM GC feature.
     - `--experimental-wasm-stringref`: This flag is needed to enable support for the `stringref` feature.

### How to Run

   To run your WebAssembly file, use the following command:

   ```shell
   node --experimental-wasm-gc --experimental-wasm-stringref run_module.js /path/to/your.wasm
   ```

   The parameters to pass to the exported WASM function should followed by the module path, if needed.

   You can also use the following options if needed:

   - `-f`: specify the exported WASM function you want to execute in Node.js.
   - `-s`: specify to execute the `_start` WASM function to initialize global variables if necessary.

### Example

   Here is an example.

   The `example.wasm` file is generated from the following TypeScript source code:

   ```typescript
   export function foo(a: number, b: string) {
      if (b === 'Hello World') {
         return a;
      }
      return a + 1;
   }
   ```
   The following command demonstrates how to run the exported function `foo`:

   ```shell
   node --experimental-wasm-gc --experimental-wasm-stringref run_module.js -f foo example.wasm 1 'Hello World'
   ```

   it will output `1`.

## Run module on chrome

### Prerequisites
- Set chrome flags by `chrome://flags`, should set these flags as enabled:
   - Experimental WebAssembly
   - WebAssembly Garbage Collection
   - WebAssembly Stringref

### How to Run
Start a server, open the `run_module_on_chrome.html` on chrome, fill in with the wasm path, the wasm function name, and arguments(must be separated by commas), then click `submit` button, and the result will be print on the page.