"use strict";
/* The Computer Language Benchmarks Game
   https://salsa.debian.org/benchmarksgame-team/benchmarksgame/
   contributed by Isaac Gouy
   modified by Andrey Filatkin
   modified for typescript by Isaac Gouy
   modified for deno runtime by hanabi1224
*/

/* This file is modified base on:
 *  https://github.com/hanabi1224/Programming-Language-Benchmarks/blob/main/bench/algorithm/nbody/6.ts
 */
// const PI = Math.PI;
var PI = 3.141592653589793;
var SOLAR_MASS = 4 * PI * PI;
var DAYS_PER_YEAR = 365.24;
function Jupiter() {
    return {
        x: 4.8414314424647209,
        y: -1.16032004402742839,
        z: -1.03622044471123109e-1,
        vx: 1.66007664274403694e-3 * DAYS_PER_YEAR,
        vy: 7.69901118419740425e-3 * DAYS_PER_YEAR,
        vz: -6.90460016972063023e-5 * DAYS_PER_YEAR,
        mass: 9.54791938424326609e-4 * SOLAR_MASS
    };
}
function Saturn() {
    return {
        x: 8.34336671824457987,
        y: 4.12479856412430479,
        z: -4.03523417114321381e-1,
        vx: -2.76742510726862411e-3 * DAYS_PER_YEAR,
        vy: 4.99852801234917238e-3 * DAYS_PER_YEAR,
        vz: 2.30417297573763929e-5 * DAYS_PER_YEAR,
        mass: 2.85885980666130812e-4 * SOLAR_MASS
    };
}
function Uranus() {
    return {
        x: 1.2894369562139131e1,
        y: -1.51111514016986312e1,
        z: -2.23307578892655734e-1,
        vx: 2.96460137564761618e-3 * DAYS_PER_YEAR,
        vy: 2.3784717395948095e-3 * DAYS_PER_YEAR,
        vz: -2.96589568540237556e-5 * DAYS_PER_YEAR,
        mass: 4.36624404335156298e-5 * SOLAR_MASS
    };
}
function Neptune() {
    return {
        x: 1.53796971148509165e1,
        y: -2.59193146099879641e1,
        z: 1.79258772950371181e-1,
        vx: 2.68067772490389322e-3 * DAYS_PER_YEAR,
        vy: 1.62824170038242295e-3 * DAYS_PER_YEAR,
        vz: -9.5159225451971587e-5 * DAYS_PER_YEAR,
        mass: 5.15138902046611451e-5 * SOLAR_MASS
    };
}
function Sun() {
    return {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        vx: 0.0,
        vy: 0.0,
        vz: 0.0,
        mass: SOLAR_MASS
    };
}
var bodies = [Sun(), Jupiter(), Saturn(), Uranus(), Neptune()];
function offsetMomentum() {
    var px = 0;
    var py = 0;
    var pz = 0;
    var size = bodies.length;
    for (var i = 0; i < size; i++) {
        var body_1 = bodies[i];
        var mass = body_1.mass;
        px += body_1.vx * mass;
        py += body_1.vy * mass;
        pz += body_1.vz * mass;
    }
    var body = bodies[0];
    body.vx = -px / SOLAR_MASS;
    body.vy = -py / SOLAR_MASS;
    body.vz = -pz / SOLAR_MASS;
}
function advance(dt) {
    var size = bodies.length;
    for (var i = 0; i < size; i++) {
        var bodyi = bodies[i];
        var vxi = bodyi.vx;
        var vyi = bodyi.vy;
        var vzi = bodyi.vz;
        for (var j = i + 1; j < size; j++) {
            var bodyj = bodies[j];
            var dx = bodyi.x - bodyj.x;
            var dy = bodyi.y - bodyj.y;
            var dz = bodyi.z - bodyj.z;
            var d2 = dx * dx + dy * dy + dz * dz;
            var mag = dt / (d2 * Math.sqrt(d2));
            var massj = bodyj.mass;
            vxi = vxi - dx * massj * mag;
            vyi = vyi - dy * massj * mag;
            vzi = vzi - dz * massj * mag;
            var massi = bodyi.mass;
            bodyj.vx = bodyj.vx + dx * massi * mag;
            bodyj.vy = bodyj.vy + dy * massi * mag;
            bodyj.vz = bodyj.vz + dz * massi * mag;
        }
        bodyi.vx = vxi;
        bodyi.vy = vyi;
        bodyi.vz = vzi;
        bodyi.x = bodyi.x + dt * vxi;
        bodyi.y = bodyi.y + dt * vyi;
        bodyi.z = bodyi.z + dt * vzi;
    }
}
function energy() {
    var e = 0;
    var size = bodies.length;
    for (var i = 0; i < size; i++) {
        var bodyi = bodies[i];
        e +=
            0.5 *
                bodyi.mass *
                (bodyi.vx * bodyi.vx + bodyi.vy * bodyi.vy + bodyi.vz * bodyi.vz);
        for (var j = i + 1; j < size; j++) {
            var bodyj = bodies[j];
            var dx = bodyi.x - bodyj.x;
            var dy = bodyi.y - bodyj.y;
            var dz = bodyi.z - bodyj.z;
            var distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            e -= (bodyi.mass * bodyj.mass) / distance;
        }
    }
    return e;
}
function main() {
    var n = 1000000;
    offsetMomentum();
    energy();
    for (var i = 0; i < n; i++) {
        advance(0.01);
    }
    energy();
}

main()
