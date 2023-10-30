/* This file is modified base on:
 *  https://github.com/hanabi1224/Programming-Language-Benchmarks/blob/main/bench/algorithm/binarytrees/1.ts
 */

interface ITreeNode {
    left: ITreeNode | null;
    right: ITreeNode | null;
}

export function main() {
    const maxDepth: number = Math.max(10, 0);
    const stretchDepth: number = maxDepth + 1;
    const stretchTree = createTree(stretchDepth);
    //console.log(`stretch tree of depth ${stretchDepth} check: ${checksum(stretchTree)}`)
    const longLivedTree = createTree(maxDepth);

    for (let depth = 4; depth <= maxDepth; depth += 2) {
        const iterations: number = Math.pow(2, maxDepth) - depth + 4;
        let sum = 0;
        for (let i = 0; i < iterations; i++) {
            const tree = createTree(depth);
            sum += checksum(tree);
        }
        //console.log(`${iterations} trees of depth ${depth} check: ${sum}`)
    }
}

function checksum(node: ITreeNode | null): number {
    if (!node) {
        return 1;
    }
    if (!node.left) {
        return 1;
    }
    return 1 + checksum(node.left) + checksum(node.right);
}

function createTree(depth: number): ITreeNode {
    if (depth > 0) {
        depth--;
        return { left: createTree(depth), right: createTree(depth) };
    } else {
        return { left: null, right: null };
    }
}
