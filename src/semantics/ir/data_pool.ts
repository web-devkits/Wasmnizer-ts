/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

const INC_SIZE = 1024 * 4;
export class DataPool {
    private buffer: Uint8Array;
    private capacity: number;
    private size: number;

    private strMap = new Map<string, number>();

    constructor() {
        this.buffer = new Uint8Array(INC_SIZE);
        this.capacity = INC_SIZE;
        this.size = 0;
    }

    addString(s: string): number {
        if (this.strMap.has(s)) return this.strMap.get(s)!;

        this.updateBufferSize(s.length);

        const size = this.size;

        let i;
        for (i = 0; i < s.length; i++) {
            const byte = s.charCodeAt(i);
            if (byte >= 256) throw Error('UTF-16 string not supported');
            this.buffer[size + i] = byte;
        }
        i = s.length + size;
        this.buffer[i++] = 0;
        while (i % 4 != 0) {
            this.buffer[i++] = 0;
        }
        this.size = i;
        return size;
    }

    getStringCount(): number {
        return this.strMap.size;
    }

    addByte(byte: number): number {
        this.updateBufferSize(1);
        this.buffer[this.size++] = byte & 0xff;
        return this.size - 1;
    }

    getCurrentSize(): number {
        return this.size;
    }

    addInt32(n: number): number {
        //littel endian
        const size = this.addByte(n & 0xff);
        this.addByte((n >> 8) & 0xff);
        this.addByte((n >> 16) & 0xff);
        this.addByte((n >> 24) & 0xff);
        return size;
    }

    setByte(idx: number, byte: number) {
        this.buffer[idx] = byte & 0xff;
    }

    setInt32(idx: number, n: number) {
        this.setByte(idx, n & 0xff);
        this.setByte(idx + 1, (n >> 8) & 0xff);
        this.setByte(idx + 2, (n >> 16) & 0xff);
        this.setByte(idx + 3, (n >> 24) & 0xff);
    }

    updateBufferSize(inc_size: number) {
        if (this.size + inc_size > this.capacity) {
            const capacity = this.capacity + INC_SIZE;
            const buffer = new Uint8Array(capacity);
            for (let i = 0; i < this.size; i++) {
                buffer[i] = this.buffer[i];
            }
            this.capacity = capacity;
            this.buffer = buffer;
        }
    }

    getData(): Uint8Array {
        return new Uint8Array(this.buffer.buffer, 0, this.size);
    }
}
