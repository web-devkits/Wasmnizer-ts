# Class

Classes are declared using the `class` keyword

## Class fields

``` TypeScript
class Car {
    price: number = 0;              // field with initializer
    color: string;                  // field without initializer, must be initialized in constructor
    private owner: string;          // field with visibility modifier
    readonly producer: string;      // field with readonly modifier
    static isCar: boolean = true;   // static field
    isNew? : boolean;               // optional field
    method: (x: number) => number;  // field with function type

    constructor(color: string) {    // constructor
        this.color = color;
        this.owner = "B";
        this.producer = "C";
        this.isNew = true;
        this.method = (x: number) => x + 1;
    }
}
```

## Class method

``` TypeScript
class Car {
    private speed_: number = 0;
    mileage = 0;

    // method with visibility modifier
    public drive(second: number) {
        this.mileage += this.speed_ * second;
    }

    // static method
    static isCar() {
        return true;
    }

    // getter
    get speed() {
        return this.speed_;
    }

    // setter
    set speed(sp: number){
        this.speed_ = sp;
    }
}
```

## Inheritance

``` TypeScript
class Car {
    price: number = 0;
    color: string;
    constructor(color: string) {
        this.color = color;
    }
    drive() {
        console.log("drive");
    }
}

class Bus extends Car {
    height: number;
    constructor(color: string, height: number) {
        super(color);
        this.height = height;
    }
    drive() {
        console.log("bus drive");
        super.drive();
    }
}
```

## Instantiate class

``` TypeScript
let car = new Car("red");
```

derived class can be assigned to base class

``` TypeScript
let bus: Car = new Bus("blue", 10);
```

## Capture `this`

Functions defined inside non-static method can capture `this`

``` TypeScript
class A {
    n: number = 10;
    say(){
        let anonymousFunc = () => console.log(this.n);
        return anonymousFunc;
    }
}

let a = new A();
a.say()();  // 10
```

## Limitations

- ##### declare field in constructor parameter list is **not supported**

    ``` TypeScript
    class Car {
        // Not Supported
        constructor(private owner: string) {    // field in constructor parameter list
        }
    }
    ```

- ##### Assign a function to a class method is **not supported**

    ``` TypeScript
    let car = new Car();
    // Not Supported
    car.drive = (second: number) => { }
    ```

- ##### Class method with `this` parameter is **not supported**

    ``` TypeScript
    class Car {
        // Not Supported
        drive(this: Car, second: number) { }
    }
    ```

- ##### Use class as value is **not supported**

    ``` TypeScript
    // Not Supported
    let car = Car;
    ```

- ##### Index signatures for class is **not supported**

    ``` TypeScript
    class MyClass {
        // Not Supported
        [s: string]: boolean | ((s: string) => boolean);

        check(s: string) {
            return this[s] as boolean;
        }
    }
    ```

- ##### Assign to different class with same structure is **not supported by design**

    In ts2wasm-compiler, classes are treated as **nominal typing**. This is because class names represent abstractions of real-world entities, and defining class relationships based on structure rather than names can introduce error-prone code.

    ``` TypeScript
    class Person {
        name: string = '';
        age: number = 0;
    }

    class Employee {
        name: string = '';
        age: number = 0;
        salary: number = 0;
    }

    class Employee1 extends Person {
        salary: number = 0;
    }

    // Not Supported
    const p: Person = new Employee();
    // OK
    const p1: Person = new Employee1();
    ```
