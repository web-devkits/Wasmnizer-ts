"use strict";
/* The Computer Language Benchmarks Game
   https://salsa.debian.org/benchmarksgame-team/benchmarksgame/
   contributed by Isaac Gouy
*/

function approximate(n) {
    var u = new Array(n), v = new Array(n);
    for (var i = 0; i < n; ++i) {
        u[i] = 1.0;
    }
    for (var i = 0; i < 10; ++i) {
        multiplyAtAv(n, u, v);
        multiplyAtAv(n, v, u);
    }
    var vBv = 0.0, vv = 0.0;
    for (var i = 0; i < 10; ++i) {
        vBv += u[i] * v[i];
        vv += v[i] * v[i];
    }
    return Math.sqrt(vBv / vv);
}
function a(i, j) {
    return 1.0 / (((i + j) * (i + j + 1)) / 2 + i + 1);
}
function multiplyAv(n, v, av) {
    for (var i = 0; i < n - 1; ++i) {
        av[i] = 0.0;
        for (var j = 0; j < n - 1; ++j) {
            av[i] = av[i] + a(i, j) * v[j];
        }
    }
}
function multiplyAtv(n, v, atv) {
    for (var i = 0; i < n - 1; ++i) {
        atv[i] = 0.0;
        for (var j = 0; j < n - 1; ++j) {
            atv[i] = atv[i] + a(j, i) * v[j];
        }
    }
}
function multiplyAtAv(n, v, atAv) {
    var u = new Array(n);
    multiplyAv(n, v, u);
    multiplyAtv(n, u, atAv);
}
function main() {
    var n = 2000;
    approximate(n);
}

main()
