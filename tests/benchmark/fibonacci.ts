function fibonacci(num: number): number {
    if (num < 2) {
        return num;
    } else {
        return fibonacci(num - 1) + fibonacci(num - 2);
    }
}

export function main() {
    fibonacci(35);
}
