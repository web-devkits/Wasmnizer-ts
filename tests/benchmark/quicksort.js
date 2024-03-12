"use strict";
/* This file is modified base on:
 *  https://browserbench.org/JetStream/wasm/quicksort.c
 */
var SORTELEMENTS = 1e5;
var maximum = 0;
var minimum = 65536;
function rand(seed) {
    seed = (seed * 1309 + 13849) & 65535;
    return seed;
}
function initArr(sortList) {
    var seed = 74755;
    for (var i = 1; i <= SORTELEMENTS; i++) {
        sortList[i] = rand(seed);
        if (sortList[i] > maximum) {
            maximum = sortList[i];
        }
        else if (sortList[i] < minimum) {
            minimum = sortList[i];
        }
    }
}
function quickSort(a, l, r) {
    var i = l, j = r;
    var w;
    var idx = Math.floor((l + r) / 2);
    var x = a[idx];
    do {
        while (a[i] < x)
            i++;
        while (x < a[j])
            j--;
        if (i <= j) {
            w = a[i];
            a[i] = a[j];
            a[j] = w;
            i++;
            j--;
        }
    } while (i <= j);
    if (l < j)
        quickSort(a, l, j);
    if (i < r)
        quickSort(a, i, r);
}
function main() {
    var sortList = new Array(SORTELEMENTS + 1);
    initArr(sortList);
    quickSort(sortList, 1, SORTELEMENTS);
    if (sortList[1] != minimum || sortList[SORTELEMENTS] != maximum) {
        console.log('Validate result error in quicksort');
    }
}

main()
