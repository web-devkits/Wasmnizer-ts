/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

class Home {
    printTag(str:string){
        console.log(str);
    }
    element(id: number) {
        console.log(id);
    }
    render() {
        const arr: string[] = ['start', 'stop', 'pause', 'resume']
        arr.forEach((val, index, arr) => {
            const node_event = {
                event: (text: string, hh: number) => {
                    this.element(hh);
                }
            }
            this.printTag(val);
        });
    }
}

export function useThisInClosure() {
    let home = new Home();
    home.render();
}
