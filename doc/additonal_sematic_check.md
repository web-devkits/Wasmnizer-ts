# Additional Sematic Check

## Motivation
Due to the partially features of TypeScript and the current limitations of WebAssembly, the compiler has imposed some restrictions on the usage of TypeScript syntax. This doc records additional sematic checking information of the `Wasmnizer-ts`.

## Items

The following terms outline specific additional sematic checks.

| item                            | description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| nominal class                   | the operation between two nomial classes(different class name, or t the two classes do not have a subtyping relationship) |
| closure with default parameters | innter function or closure with default parameters           |
| invoke any object               | treat any type as an object and access its properties        |
| array without a specified element type     | declare `Array` without a typeargument, for exampe `new Array()` |
| void type value as variable, or as function argument    | `const a: void = undefined` |

If those rules above are triggered, an error will be throwed, the details will be dump to the log file.

Note that the most of these terms are implemented in the `sematic_check` file except the check of `array without a specified element type`, because we lost the AST information when traversing `Expression`, it will be handled when parsing on sematic tree.


## Details

Here are some examples and details about additional sematic checking.

+ the format of error message

    `[error type]: in [function name where the error occurred], error flag: xxx , message: xxx`

    For example

    ``` shell
    [closure with default parameters]: in [test|foo|bar], error flag: '2', message: 'inner function has default parameters'
    ```

    this message shows that in function `test|foo|bar`, there occurs a inner function with defalut parameters error, its error flag is 2.

+  meaning of error flags

    **\[0]: BinaryOperationOnNominalClass**

    `Wasmnizer-ts` treats class type as nominal, because different named class types have distinct meanings and purposes. So operating on different types will not pass through the additional semantic checks.

    For example:

    ```typescript
    class Foo {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    class Bar {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    const f = new Foo(0);
    const b: Bar = f; // not pass
    ```

    **\[1]: ReturnTypesAreNominalClass**

    The reason is the same as mentioned in `BinaryOperationOnNominalClass` above, here is an example:

    ```typescript
    class Foo {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    class Bar {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    export function baz(): Bar {
        return new Foo(0); // not pass
    }
    ```

    **\[2]: ArgsAndParamsTypesAreNominalClass**

    The reason is the same as mentioned in `BinaryOperationOnNominalClass` above, here is an example:

    ```typescript
    class Foo {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    class Bar {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    export function baz(f: Foo) {
        // ...
    }
    baz(new Bar());
    ```

    **\[3]: ClosureOrInnerFuncHasDefaultParams**

    Currently in `Wasmnizer-ts`, only top-level functions are allowed to have default parameters. so inner function or closure with default parameters will not pass the checks.

    ```typescript
    function foo() {
        // inner function 'bar' has default parameters, so it won't pass the check.
        function bar(x = 10) {
            //
        }
    }
    ```

    **\[4]: InvokeAnyObject**

    `Wasmnizer-ts`  provides the capability to work with dynamic types, but it imposes restrictions on accessing properties of dynamic types and assigning them to static types. For exmaple:

    ```typescript
    class Foo {
        x: number;
        constructor(xx: number) {
            this.x = xx;
        }
    }
    const f: any = new Foo(0);
    const x: number = f.x; // not pass
    ```

    it requires type casting if want to access the property of dynamic types and assign it to static types:

    ```typescript
    // ...
    const x: number = f.x as number; // passed
    ```

    **\[5]: VoidTypeAsVarType**

    `Wasmnizer-ts` does not yet support 'void' as a variable type, so using 'void' as a variable type will not pass the check:

    ```typescript
    const v: void = undefined; // not pass
    function foo(v: void) { // not pass
        // ...
    }
    ```

    **array without a specified element type**

    ```typescript
    const arr: number[] = new Array(); // not pass
    const arr = new  Array(); // passed, `arr` has type any[]
    const arr: number[] = new Array<number>(); // passed
    const arr = new Array<number>(); // passed, `arr` has type number[]
    ```
