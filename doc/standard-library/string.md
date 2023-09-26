# string API

The standard string APIs are implemented by `binaryen API`. Below are the string APIs supported by `Wasmnizer-ts`.

Please note that specific implementations may differ slightly from libraries like JavaScript Core Library. For uniform APIs, hyperlinks to their descriptions will be provided. In situations where there are variations, this document offers API descriptions along with explanations for the differences.


+ **[`concat(...strings: string[]): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L408C1-L412C42)**

+ **[`slice(start?: number, end?: number): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L460C1-L466C49)**

+ **[`charAt(pos: number): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L396C1-L400C33)**

+ **[`charCodeAt(index: number): number`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L402C1-L406C39)**

+ **[`substring(start: number, end?: number): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L475C1-L481C52)**

+ **[`trim(): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L495C1-L496C20)**

+ **[`toLowerCase(): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L483C1-L484C27)**

+ **[`toUpperCase(): string`](https://github.com/microsoft/TypeScript/blob/c532603633178c552b9747eef057784db2fc1e23/src/lib/es5.d.ts#L489C1-L490C27)**

+ **`indexOf(searchString: string): number`**

    **Description**: Searches for the first occurrence of a specified substring (`searchString`) within a string and returns the index at which it is found, otherwise, returns -1.

    Passing the starting search index has not been implemented yet.

+ **`lastIndexOf(str: string): number`**

    **Description**: Searches for the last occurrence of a specified substring (`str`) within a string and returns the index (position) at which it is found, otherwise, returns -1.

    Passing the starting search index has not been implemented yet.

+ **`split(sep: string): string[]`**

    **Description**: Splits a string into an array of substrings based on a specified separator (`sep`).

    `RegExp` has not been implemented yet.

+ **`replace(from: string, to: string): string`**

    **Description**: Replaces **the first** occurrence of a specified substring (`from`) within a string with another substring (`to`) and returns the resulting modified string.

    `RegExp` has not been implemented yet.

+ **`match(pattern: string): string[]`**

    **Description**: Searches for **the first** occurrence of a specified regular expression (`pattern`) within a string and returns an array containing the matched substring.

    `RegExp` has not been implemented yet.

+ **`search(pattern: string): number`**

    **Description**: Searches for a specified regular string (`pattern`) within a string and returns the index of the first occurrence of the matched substring or -1 if no match is found.

    `RegExp` has not been implemented yet.
