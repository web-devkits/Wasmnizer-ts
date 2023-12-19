/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repo_root_dir = path.resolve(__dirname, '..');

let distDir = path.resolve(repo_root_dir, 'build');

const path_to_copy = [
    'lib/builtin',
    'src/backend/binaryen/lib/interface'
]

if (process.argv.length > 2) {
    distDir = path.resolve(repo_root_dir, process.argv[2]);
}

path_to_copy.forEach((p) => {
    if (!fs.existsSync(path.join(repo_root_dir, p))) {
        fs.mkdirSync(path.join(repo_root_dir, p), { recursive: true })
    }

    const cur_dst_path = path.join(distDir, p)

    fs.cpSync(path.join(repo_root_dir, p), cur_dst_path, { recursive: true })
})
