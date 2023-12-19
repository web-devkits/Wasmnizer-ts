/* This file is modified base on:
 *  https://browserbench.org/JetStream/wasm/quicksort.c
 */
const SORTELEMENTS = 1e5;
let seed = 0;
let maximum: number, minimum: number;
const sortList = new Array<number>(SORTELEMENTS + 1);

function rand() {
    seed = (seed * 1309 + 13849) & 65535;
    return seed;
}

function initArr() {
    seed = 74755;
    maximum = 0;
    minimum = 65536;

    for (let i = 1; i <= SORTELEMENTS; i++) {
        sortList[i] = rand();
        if (sortList[i] > maximum) {
            maximum = sortList[i];
        } else if (sortList[i] < minimum) {
            minimum = sortList[i];
        }
    }
}

function quickSort(a: number[], l: number, r: number) {
    let i = l,
        j = r;
    let w: number;
    const idx = Math.floor((l + r) / 2);
    const x = a[idx];
    do {
        while (a[i] < x) i++;
        while (x < a[j]) j--;
        if (i <= j) {
            w = a[i];
            a[i] = a[j];
            a[j] = w;
            i++;
            j--;
        }
    } while (i <= j);

    if (l < j) quickSort(a, l, j);
    if (i < r) quickSort(a, i, r);
}

export function main() {
    initArr();
    quickSort(sortList, 1, SORTELEMENTS);
    if (sortList[1] != minimum || sortList[SORTELEMENTS] != maximum) {
        console.log('Validate result error in quicksort');
    }
}
