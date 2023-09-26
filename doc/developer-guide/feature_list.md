# Wasmnizer-ts feature list

Table column definition:
- `feature`
    TypeScript keyword/type/syntax/concepts

- `WAMR`
    Whether this feature is supported on [WebAssembly Micro Runtime (WAMR)](https://github.com/bytecodealliance/wasm-micro-runtime)

- `chrome`
    Whether this feature is supported on chrome browser

- `popularity`
    The frequency of the feature used in TypeScript.
    - empty means less used, or not evaluated
    - :star: means frequently used by experienced TypeScript developers
    - :star::star: means frequently used by both experienced and begging TypeScript developers

## Primitives

| feature | WAMR | chrome | popularity |
| :---: | :---: | :---: | :---: |
| boolean | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| number | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| string | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| string template | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| bigint | :x: | :x: | |
| symbol | :x: | :x: | |

## [Class](./class.md)

| feature | WAMR | chrome | popularity |
| :---: | :---: | :---: | :---: |
| declaration | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| inherit | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| method overwrite | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| static field/method | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| field initializer | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| visibility control | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| getter/setter | :heavy_check_mark: | :heavy_check_mark: |
| [class as value](./class.md#use-class-as-value-is-not-supported) | :x: | :x: |

## [Function](./function.md)

| feature | WAMR | chrome | popularity |
| :---: | :---: | :---: | :---: |
| closure | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| optional parameter | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| function default parameter | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| method default parameter | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| closure default parameter | :x: | :x: | |
| destructor parameter | :x: | :x: | :star::star: |
| rest parameter | :heavy_check_mark: | :heavy_check_mark: | :star: |
| this binding | :x: | :x: | :star: |
| overload | :x: | :x: | :star: |

## [Interface](./interface.md)

| feature | WAMR | chrome | popularity |
| :---: | :---: | :---: | :---: |
| explicitly implemented interface | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| implicitly implemented interface | :heavy_check_mark: | :x: | :star::star: |
| readonly fields | :heavy_check_mark: | :x: | |
| function signature | :x: | :x: | |
| indexed signature | :x: | :x: | |

## Enum

| feature | WAMR | chrome | popularity |
| :---: | :---: | :---: | :---: |
| numeric enum | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| string enum | :heavy_check_mark: | :heavy_check_mark: | :star::star: |
| heterogeneous enum | :x: | :x: |  |

## Built-in objects/method

| feature | WAMR | chrome | popularity | note |
| :---: | :---: | :---: |  :---: | :---: |
| console | :heavy_check_mark: | :x: | :star::star: | only support `log` |
| Object | :x: | :x: | :star: | |
| Function | :x: | :x: | | |
| JSON | :heavy_check_mark: | :x: | :star::star: | [fallback to dynamic](./fallback.md) |
| Date | :heavy_check_mark: | :x: | :star::star: | [fallback to dynamic](./fallback.md) |
| Math | :heavy_check_mark: | :heavy_check_mark: | :star::star: | only support `pow`, `max`, `min`, `sqrt`, `abs`, `ceil`, `floor` |
| Number | :x: | :x: | :star::star: | |
| [String](../standard-library/string.md) | :heavy_check_mark: | :heavy_check_mark: | :star::star: | |
| [Array](../standard-library/array.md) | :heavy_check_mark: | :x: | :star::star: | |
| Map | :heavy_check_mark: | :x: | :star::star: | [fallback to dynamic](./fallback.md) |
| Set | :heavy_check_mark: | :x: | :star: | [fallback to dynamic](./fallback.md) |
| ArrayBuffer | :x: | :x: | :star: | |
| RegExp | :x: | :x: | :star: | |
| ... others | :x: | :x: | | |

## Wasm runtime capabilities
| feature | WAMR | chrome | popularity | note |
| :---: | :---: | :---: | :---: | :---: |
| exception handling | :x: | :heavy_check_mark: | :star::star: | |
| promise | :heavy_check_mark: | :x: | :star::star: | [fallback to dynamic](./fallback.md) |
| source debugging | :x: | :heavy_check_mark: | :star::star: | |
| AoT compilation | :x: | :x: | | |
| async/await | :x: | :x: | :star::star: | |
| import host API | :heavy_check_mark: | :heavy_check_mark: | | [import host API](./expose_host_API.md) |

## [Dynamics](./any_object.md)
| feature | WAMR | chrome | popularity | note |
| :---: | :---: | :---: | :---: | :---: |
| any | :heavy_check_mark: | :heavy_check_mark: | :star: | |
| unknown | :x: | :x: | | |
| never | :x: | :x: | | |
| assign static to any | :heavy_check_mark: | :heavy_check_mark: | | |
| assign any to static | :heavy_check_mark: | :heavy_check_mark: | | |
| property access | :heavy_check_mark: | :heavy_check_mark: | :star::star: | |
| prototype | :heavy_check_mark: | :heavy_check_mark: | :star: | |
| comparison | :heavy_check_mark: | :x: | :star: | |
| arithmetic operation | :heavy_check_mark: | :heavy_check_mark: | :star::star: | only support `number` and `string` |
| mixed type | :heavy_check_mark: | :x: | | Box static object to any and add new property on it |
| dynamic function | :x: | :x: | | |
| eval | :x: | :x: | | |

## Type casting
| feature | WAMR | chrome | popularity | note |
| :---: | :---: | :---: | :---: | :---: |
| static to static | :heavy_check_mark: | :heavy_check_mark: |  | static type checking |
| static to dynamic | :heavy_check_mark: | :heavy_check_mark: | |always success |
| dynamic to static | :heavy_check_mark: | :heavy_check_mark: | |runtime type checking |
| dynamic to dynamic | :heavy_check_mark: | :heavy_check_mark: | | no check |

## Misc
| feature | WAMR | chrome | popularity | note |
| :---: | :---: | :---: | :---: | :---: |
| typeof | :heavy_check_mark: | :x: | :star: | |
| instanceof | :heavy_check_mark: | :heavy_check_mark: | :star: | |
| toString | :heavy_check_mark: | :x: | :star::star: | |
| for ... of | :heavy_check_mark: | :heavy_check_mark: | :star::star: | |
| for ... in | :x: | :x: | :star::star: | |
| generic | :x: | :x: | | |
| module (static import) | :heavy_check_mark: | :heavy_check_mark: | :star::star: | |
| module (dynamic import) | :x: | :x: | | |