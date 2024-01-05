/* This file is modified base on:
 *  https://github.com/ColinEberhardt/wasm-mandelbrot/blob/master/assemblyscript/mandelbrot.ts
 */

// const WIDTH = 1200;
// const HEIGHT = 800;

type i32 = number;

function colour(iteration: i32, offset: i32, scale: i32): i32 {
    iteration = (iteration * scale + offset) & 1023;
    if (iteration < 256) {
        return iteration;
    } else if (iteration < 512) {
        return 255 - (iteration - 255);
    }
    return 0;
}

function iterateEquation(x0: number, y0: number, maxiterations: i32): i32 {
    let a = 0.0,
        b = 0.0,
        rx = 0.0,
        ry = 0.0,
        ab: number;
    let iterations: i32 = 0;
    while (iterations < maxiterations && rx * rx + ry * ry <= 4) {
        rx = a * a - b * b + x0;
        ab = a * b;
        ry = ab + ab + y0;
        a = rx;
        b = ry;
        iterations++;
    }
    return iterations;
}

function scale(
    domainStart: number,
    domainLength: number,
    screenLength: number,
    step: number,
): number {
    return domainStart + domainLength * (step * (1.0 / screenLength) - 1);
}

function mandelbrot(
    data: i32[],
    HEIGHT: i32,
    WIDTH: i32,
    maxIterations: i32,
    cx: number,
    cy: number,
    diameter: number,
) {
    const verticalDiameter = (diameter * HEIGHT) / WIDTH;
    for (let y: i32 = 0; y < HEIGHT; ++y) {
        for (let x: i32 = 0; x < WIDTH; ++x) {
            // convert from screen coordinates to mandelbrot coordinates
            const rx = scale(cx, diameter, WIDTH, x);
            const ry = scale(cy, verticalDiameter, HEIGHT, y);
            const iterations: i32 = iterateEquation(rx, ry, maxIterations);
            const outside = iterations == maxIterations;
            const idx: i32 = (x + y * WIDTH) << 2;
            const maxIterationValue: i32 = 0;
            data[idx + 0] = outside
                ? maxIterationValue
                : colour(iterations, 0, 4);
            data[idx + 1] = outside
                ? maxIterationValue
                : colour(iterations, 128, 4);
            data[idx + 2] = outside
                ? maxIterationValue
                : colour(iterations, 356, 4);
            data[idx + 3] = 255;
        }
    }
}

export function main() {
    const WIDTH: i32 = 1200;
    const HEIGHT: i32 = 800;
    const data: i32[] = new Array(WIDTH * HEIGHT * 4);
    mandelbrot(
        data,
        HEIGHT,
        WIDTH,
        10000,
        -0.743644786,
        0.1318252536,
        0.00029336,
    );
}
