# Array API

The standard array APIs are implemented by `native`. Here we list the APIs supported by `Wasmnizer-ts`.

Please note that specific implementations may differ slightly from libraries like JavaScript Core Library. For uniform APIs, hyperlinks to their descriptions will be provided. In situations where there are variations, this document offers API descriptions along with explanations for the differences.

+ [**`push(...items: T[]): number`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1313-L1317)

+ [**`join(separator?: string): string`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1330-L1334)

+ [**`reverse(): T[]`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1335-L1339)

+ [**`slice(start?: number, end?: number): T[]`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1345-L1354)

+ [**`unshift(...items: T[]): number`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1381-L1385)

+ [**`indexOf(searchElement: T, fromIndex?: number): number`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1386-L1391)

+ [**`lastIndexOf(searchElement: T, fromIndex?: number): number`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1392-L1397)

+ [**`reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1449-L1455)

+ [**`reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es5.d.ts#L1462-L1468)

+ [**`fill(value: T, start?: number, end?: number): T[]`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es2015.core.d.ts#L25-L33)

+ [**`includes(searchElement: T, fromIndex?: number): boolean`**](https://github.com/microsoft/TypeScript/blob/eb374c28d6810e317b0c353d9b1330b0595458f4/src/lib/es2016.array.include.d.ts#L2-L7)

+ **`pop(): T`**

    **Description**: Remove and return the last element from array.

    In `Wasmnizer-ts`, we will regard the union type `T | undefined` as any type, so we only define `T` as return type here.

+ **`concat(...items: T[]): T[]`**

    **Description**: Concatenate multiple arrays and returns a new array containing the merged elements.

    We simply set the `items`'s type to `T[]`.

+ **`shift(): T`**

    **Description**: Remove and return the first element from array.

    In `Wasmnizer-ts`, we will regard the union type `T | undefined` as any type, so we only define `T` as return type here.

+ **`sort(compareFn: (a: T, b: T) => number): T[]`**

    **Description**:  Sort the elements of an array in place and return the sorted array by a comparison function `compareFn`.

    In `Wasmnizer-ts`, `this` represents class instance, so the return type is set to `T[]` not `this`.

+ **`splice(start: number, deleteCount?: number, ...items: T[]): T[]`**

    **Description**: Change the contents of an array by removing, replacing, or adding elements.

    Combines two standard APIs: `splice(start: number, deleteCount?: number): T[];` and `splice(start: number, deleteCount: number, ...items: T[]): T[];`.

+ **`every(predicate: (value: T, index: number, array: T[]) => boolean): boolean`**

     **Description**: Applies a provided callback function `predicate` to each element in the array and returns `true` if the callback returns `true` for every element, otherwise, it returns `false`.

    We set the `predicate callback function`'s return type to boolean, and the second parameter `thisArg` in the standard library has been deleted.

+ **`some(predicate: (value: T, index: number, array: T[]) => boolean): boolean`**

    **Description**: Applies a provided callback function `predicate` to each element in the array and returns `true` if the callback returns `true` for at least one element, otherwise, it returns `false`.

    We set the `predicate callback function`'s return type to boolean, and the second parameter `thisArg` in the standard library has been deleted.

+ **`forEach(callbackfn: (value: T, index: number, array: T[]) => void): void`**

    **Description**: Iterate over the elements of an array and apply provided callback function `callbackfn` to each element.

    The second parameter `thisArg` in the standard library has been deleted.

+ **`map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[]`**

    **Description**: Return a new array containing the results of applying the callback function `callbackfn` to each element.

    The second parameter `thisArg` in the standard library has been deleted.

+ **`filter(predicate: (value: T, index: number, array: T[]) => boolean): T[]`**

    **Description**: Return a new array containing elements that satisfy the condition specified in the callback function `predicate`.

    We set the `predicate callback function`'s return type to boolean, and the second parameter `thisArg` in the standard library has been deleted.

+ `find(predicate: (value: T, index: number, obj: T[]) => boolean): any`**

    **Description**: Search for and return the first element in an array that satisfies a specified condition defined by a provided callback function `predicate`, otherwise, return `undefined`.

    We set the `predicate callback function`'s return type to boolean, the second parameter `thisArg` in the standard library has been deleted, since `find` is always return `undefined`, so we set `any` type to represent `T | undefined`.

+ **`findIndex(predicate: (value: T, index: number, obj: T[]) => boolean): number`**

    **Description**: Return the index of the first element in an array that satisfies a specified condition defined by a provided callback function `predicate`, otherwise, return -1.

    We set the `predicate callback function`'s return type to boolean, and the second parameter `thisArg` in the standard library has been deleted.


+ **`copyWithin(target: number, start: number, end?: number): T[]`**

    **Description**: Copy a portion of an array to another location within the same array.

    In `Wasmnizer-ts`, `this` represents class instance, so the return type is set to `T[]` not `this`.
