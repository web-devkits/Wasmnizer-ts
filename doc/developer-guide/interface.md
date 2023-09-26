# interface

## Interface declaration

``` TypeScript
interface I {
    x: number;
    readonly z: string; // field with readonly modifier
    foo: () => number;  // method
    set m(v: number);   // setter
    get m();            // getter
}
```

## Implement interface

``` TypeScript
class C implements I {
    x: number = 0;
    z: string = "z";
    get m() {
        return this.x;
    }
    set m(v: number) {
        this.x = v;
    }
    foo(): number {
        return 0;
    }
}
```

In TypeScript, `implements` is not required, any objects satisfies the fields defined by the interface are treated implemented those interfaces. But it is recommended to use `implements` when using ts2wasm-compiler since the compiler may apply further optimization according to these information.

## Assign to interface

interface can be assigned from an object literal or class instance.

``` TypeScript
interface I {
    x: number;
}

let obj: I = {
    x: 10,
}

class A {
    y: number = 2;
    x: number = 1;
}

obj = new A();
```

## Optional fields

``` TypeScript
interface I {
    x: number;
    y?: number;
}

let i : I = { x: 1 };
```

Reading an un-exist optional field will return `undefined`. Writing an un-exist optional field will cause an error since it's not possible to add a new field to an static object.

``` TypeScript
console.log(i.y);   // undefined
i.y = 1;            // runtime error
```

# Limitations

- interface extends is **not supported**

    ``` TypeScript
    interface I1 {
        x: number;
    }

    // Not Supported
    interface I2 extends I1 {
        y: number;
    }
    ```

- indexed signature interface is **not supported**

    ``` TypeScript
    interface I {
        [index: number]: number;
    }
    ```

- function signature interface is **not supported**

    ``` TypeScript
    interface I {
        (x: number): number;
    }
    ```
