# Function and closure

## Declaration

There are three kind of syntax to define a function:

1. Function declaration syntax

    ``` TypeScript
    function add(x: number, y: number): number {
        return x + y;
    }
    ```

    - if this is in global scope
        - This defines a function with name `add`, and it can be directly called through the name `add`.
    - if this is inside another function scope
        - This defines a function with a mangled name which can not be directly invoked, the compiler will implicitly create a closure with the given name `add` in the outer scope,

2. Function expression syntax

    ``` TypeScript
    let add = function(x: number, y: number): number {
        return x + y;
    }
    ```

    > This defines an anonymous function, and assigned to variable `add` as a `closure`

3. Arrow function syntax

    ``` TypeScript
    let add = (x: number, y: number): number => {
        return x + y;
    }
    let add1 = (x: number, y: number): number => x + y;
    ```

    > This defines two anonymous functions, and assigned to variable `add` and `add1` as `closure`

## Parameters

### Optional parameter

``` TypeScript
function add(x: number, y: number, z?: number): number {
    if (z) {
        // type narrowing not supported, currently must explicitly cast the type
        let z_value: number = z;
        return x + y + z_value;
    } else {
        return x + y;
    }
}
```

### Default parameter

``` TypeScript
function add(x: number, y: number, z: number = 0): number {
    return x + y + z;
}
```

> Note: Default parameter is not supported in `class static method` and `closure`

### Rest parameter

``` TypeScript
function add(x: number, y: number, ...z: number[]): number {
    let sum = x + y;
    for (let i = 0; i < z.length; i++) {
        sum += z[i];
    }
    return sum;
}
```

## Function type and type alias

``` TypeScript
type Add = (x: number, y: number) => number;

let add: (x: number, y: number) => number = function(x: number, y: number): number {
    return x + y;
}

let add1: Add = function(x: number, y: number): number {
    return x + y;
}
```


# Limitations

- Function overload is **not supported**

    ``` TypeScript
    function add(x: number, y: number): number;
    function add(x: string, y: string): string;
    function add(x: any, y: any): any {
        return x + y;
    }
    ```
