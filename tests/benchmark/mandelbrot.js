"use strict";
/* This file is modified base on:
 *  https://github.com/ColinEberhardt/wasm-mandelbrot/blob/master/assemblyscript/mandelbrot.ts
 */
// const WIDTH = 1200;
// const HEIGHT = 800;
function colour(iteration, offset, scale) {
    iteration = (iteration * scale + offset) & 1023;
    if (iteration < 256) {
        return iteration;
    }
    else if (iteration < 512) {
        return 255 - (iteration - 255);
    }
    return 0;
}
function iterateEquation(x0, y0, maxiterations) {
    var a = 0.0, b = 0.0, rx = 0.0, ry = 0.0, ab;
    var iterations = 0;
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
function scale(domainStart, domainLength, screenLength, step) {
    return domainStart + domainLength * (step * (1.0 / screenLength) - 1);
}
function mandelbrot(data, HEIGHT, WIDTH, maxIterations, cx, cy, diameter) {
    var verticalDiameter = (diameter * HEIGHT) / WIDTH;
    for (var y = 0; y < HEIGHT; ++y) {
        for (var x = 0; x < WIDTH; ++x) {
            // convert from screen coordinates to mandelbrot coordinates
            var rx = scale(cx, diameter, WIDTH, x);
            var ry = scale(cy, verticalDiameter, HEIGHT, y);
            var iterations = iterateEquation(rx, ry, maxIterations);
            var outside = iterations == maxIterations;
            var idx = (x + y * WIDTH) << 2;
            data[idx + 0] = outside ? 0 : colour(iterations, 0, 4);
            data[idx + 1] = outside ? 0 : colour(iterations, 128, 4);
            data[idx + 2] = outside ? 0 : colour(iterations, 356, 4);
            data[idx + 3] = 255;
        }
    }
}
function main() {
    var WIDTH = 1200;
    var HEIGHT = 800;
    var data = new Array(WIDTH * HEIGHT * 4);
    mandelbrot(data, HEIGHT, WIDTH, 10000, -0.743644786, 0.1318252536, 0.00029336);
}

main()
