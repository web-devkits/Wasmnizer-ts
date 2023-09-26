/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include <stdio.h>
#include <stdlib.h>
#include <memory.h>


/**
 * MetaField record the properties information of object
 * name: property name
 * flag_and_index: flag and index of the property
 * type: type of the property, represent by property's type id
*/
typedef struct MetaField {
    char *name;
    int flag_and_index;
    int type;
} MetaField;

/**
 * Meta record type id and the properties information of object
 * type_id: type id of the object
 * count: number of fields
 * fields: fields information
 */

typedef struct Meta {
    int type_id;
    int impl_id;
    int count;
    MetaField fields[0];
} Meta;

#define META_FLAG_MASK 0x0000000F
#define META_INDEX_MASK 0xFFFFFFF0

/* find field index based on prop_name*/
int find_index(Meta *meta, char *prop_name, int flag) {
    MetaField f;
    int f_flag;
    int f_index;
    int s_flag = flag & META_FLAG_MASK;

    for (int i = 0; i < meta->count; i++) {
        f = meta->fields[i];
        f_flag = f.flag_and_index & META_FLAG_MASK;
        f_index = (f.flag_and_index & META_INDEX_MASK) >> 4;

        if (strcmp(f.name, prop_name) == 0 && f_flag == s_flag) {
            return f_index;
        }
    }
    return -1;
}

/* find field type based on prop_name*/
int find_type_by_index(Meta *meta, char *prop_name, int flag) {
    MetaField f;
    int f_flag;

    for (int i = 0; i < meta->count; i++) {
        f = meta->fields[i];
        f_flag = f.flag_and_index & META_FLAG_MASK;

        if (strcmp(f.name, prop_name) == 0 && f_flag == flag) {
            return f.type;
        }
    }
    return -1;
}
