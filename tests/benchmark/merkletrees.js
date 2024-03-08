"use strict";
/* This file is modified base on:
 *  https://github.com/hanabi1224/Programming-Language-Benchmarks/blob/main/bench/algorithm/merkletrees/1.ts
 */

var TreeNode = /** @class */ (function () {
    function TreeNode(value, left, right) {
        this.hash = null;
        this.value = value;
        this.left = left;
        this.right = right;
    }
    TreeNode.create = function (depth) {
        if (depth > 0) {
            var d = depth - 1;
            return new TreeNode(null, TreeNode.create(d), TreeNode.create(d));
        }
        return new TreeNode(1, null, null);
    };
    TreeNode.prototype.check = function () {
        if (this.hash != null) {
            if (this.value != null) {
                return true;
            }
            else if (this.left != null && this.right != null) {
                return this.left.check() && this.right.check();
            }
        }
        return false;
    };
    TreeNode.prototype.calHash = function () {
        if (this.hash == null) {
            if (this.value != null) {
                this.hash = this.value;
            }
            else if (this.left != null && this.right != null) {
                this.left.calHash();
                this.right.calHash();
                this.hash = this.left.getHash() + this.right.getHash();
            }
        }
    };
    TreeNode.prototype.getHash = function () {
        if (this.hash === null) {
            return -1;
        }
        else {
            return this.hash;
        }
    };
    return TreeNode;
}());
function main() {
    var maxDepth = Math.max(10, 0);
    var stretchDepth = maxDepth + 1;
    var stretchTree = TreeNode.create(stretchDepth);
    stretchTree.calHash();
    // console.log(`stretch tree of depth ${stretchDepth}\t root hash: ${stretchTree.getHash()} check: ${stretchTree.check()}`);
    var longLivedTree = TreeNode.create(maxDepth);
    for (var depth = 4; depth <= maxDepth; depth += 2) {
        var iterations = 1 << (maxDepth - depth + 4);
        var sum = 0;
        for (var i = 0; i < iterations; i++) {
            var tree = TreeNode.create(depth);
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

main()
