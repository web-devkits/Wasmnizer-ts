# Frequently Asked Questions (FAQ)

This document provides answers to some of the most frequently asked questions about Wasmnizer-ts. It is designed to help users understand the project better.

Please note that this document is continually updated and improved. If your question is not addressed here, feel free to raise an issue or contribute to the project.

### Q: Is the end goal support for the full TypeScript language? What about JavaScript?

We are trying to support more language features, but since WebAssembly opcode is statically compiled, a full coverage of TypeScript not possible. For example, `eval` and `function bind` are not supported. This may change as the Wasm specification evolves.

As for JavaScript, it's not in the scope of Wasmnizer-ts. In Wasmnizer-ts we are trying to use the type information in source code to do static compilation. The more type information in the source code, the better performance for the generated wasm module. Since JavaScript contains no type information, then Wasmnizer-ts can't get any information for static compilation.

For executing pure JavaScript in WebAssembly, maybe the VM-in-VM approach (build a JavaScript VM to WebAssembly) is more suitable.


### Q: What's an appropriate usecase for Wasmnizer-ts?

Wasmnizer-ts brings a subset of TypeScript to WebAssembly, so it can be used in many areas as long as they need programming capabilities, some typical scenarios include:

- Application programming language for IoT devices.

Wasmnizer-ts leverages WasmGC, so there is need to compile a whole language runtime inside WebAssembly, making the generated wasm module very small;

- Application programming language for function computing (FaaS)

Wasmnizer-ts brings a new choice for developers;

- A more friendly WebAssembly targeted language for frontend developers

In frontend projects, it's very common to build some CPU intensive logic to WebAssembly to get better performance.

Currently some statically typed languages such as C/C++/Rust can be successfully compiled to WebAssembly and work well, but the frontend developers may not be familiar with these languages. Wasmnizer-ts provides a new choice: the frontend developers can write TypeScript, building on their experience with JavaScript, then compile to WebAssembly.


### Q: What's the difference between Wasmnizer-ts and devicescript (https://github.com/microsoft/devicescript) ?

DeviceScript is a very interesting project which we evaluated, as well as Static TypeScript, before we started Wasmnizer-ts. We got lots of ideas about which syntax to support thanks to these projects. We're really happy to see that DeviceScript has so many useful features and APIs added.

There are some fundamental difference between Wasmnizer-ts and DeviceScript: from what we can tell, DeviceScript uses a self-defined bytecode, while Wasmnizer-ts uses WasmGC opcode. Currently WasmGC is in an early stage, so there are challenges for us to implement some features. However, as a standard bytecode format, we can gradually benefit from the new spec proposals (e.g. WasmGC Post-MVP, ESM-integration, etc), and we may even reuse some standard WASI APIs or even re-use more wasm ecosystem components in the future.

In addition we contribute to WAMR, where we implemented the WasmGC proposal but we find that there isn't too many toolchains ready for WasmGC (at time of writing, Kotlin and Dart have experimental support), so this project is also an exploration to understand how WasmGC can be used in real languages so that we can optimize our runtime implementation and even propose more useful opcodes.

We are determined and interested in driving the development of Wasmnizer-ts. It's great to see projects like DeviceScript which provide developer friendly experience in the embedded space.