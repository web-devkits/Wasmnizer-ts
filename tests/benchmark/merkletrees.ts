/* This file is modified base on:
 *  https://github.com/hanabi1224/Programming-Language-Benchmarks/blob/main/bench/algorithm/merkletrees/1.ts
 */

class TreeNode {
    hash: number | null = null;
    value: number | null;
    left: TreeNode | null;
    right: TreeNode | null;

    constructor(
        value: number | null,
        left: TreeNode | null,
        right: TreeNode | null,
    ) {
        this.value = value;
        this.left = left;
        this.right = right;
    }

    static create(depth: number): TreeNode {
        if (depth > 0) {
            const d = depth - 1;
            return new TreeNode(null, TreeNode.create(d), TreeNode.create(d));
        }
        return new TreeNode(1, null, null);
    }

    check(): boolean {
        if (this.hash != null) {
            if (this.value != null) {
                return true;
            } else if (this.left != null && this.right != null) {
                return this.left.check() && this.right.check();
            }
        }
        return false;
    }

    calHash(): void {
        if (this.hash == null) {
            if (this.value != null) {
                this.hash = this.value;
            } else if (this.left != null && this.right != null) {
                this.left.calHash();
                this.right.calHash();
                this.hash = this.left.getHash() + this.right.getHash();
            }
        }
    }

    getHash(): number {
        if (this.hash === null) {
            return -1;
        } else {
            return this.hash!;
        }
    }
}

export function main() {
    const maxDepth: number = Math.max(10, 0);
    const stretchDepth = maxDepth + 1;
    const stretchTree = TreeNode.create(stretchDepth);
    stretchTree.calHash();
    // console.log(`stretch tree of depth ${stretchDepth}\t root hash: ${stretchTree.getHash()} check: ${stretchTree.check()}`);
    const longLivedTree = TreeNode.create(maxDepth);
    for (let depth = 4; depth <= maxDepth; depth += 2) {
        const iterations = 1 << (maxDepth - depth + 4);
        let sum = 0;
        for (let i = 0; i < iterations; i++) {
            const tree = TreeNode.create(depth);
            tree.calHash();
            sum += tree.getHash();
        }
        // console.log(`${iterations}\t trees of depth ${depth}\t root hash sum: ${sum}`);
    }
    longLivedTree.calHash();
    // console.log(
    //     `long lived tree of depth ${maxDepth}\t root hash: ${longLivedTree.getHash()} check: ${longLivedTree.check()}`
    // );
}
