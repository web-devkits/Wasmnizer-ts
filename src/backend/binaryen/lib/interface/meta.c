/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include <stdio.h>
#include <stdlib.h>
#include <memory.h>


/**
 * MetaProperty record the properties information of object
 * name: property name
 * flag_and_index: flag and index of the property
 * type: type of the property, represent by property's type id
*/
typedef struct MetaProperty {
    char *name;
    int flag_and_index;
    int type;
} MetaProperty;

/**
 * Meta record type id and the properties information of object
 * type_id: type id of the object
 * count: number of properties
 * properties: properties information
 */
typedef struct Meta {
    int type_id;
    int impl_id;
    int count;
    /* property includes field, method and accessor */
    MetaProperty properties[0];
} Meta;

enum propertyFlag {
    FIELD = 0,
    METHOD = 1,
    GETTER = 2,
    SETTER = 3,
    ALL = 4,
};

#define META_FLAG_MASK 0x0000000F
#define META_INDEX_MASK 0xFFFFFFF0

/* find property index based on prop_name*/
int find_property_flag_and_index(Meta *meta, char *prop_name, enum propertyFlag flag) {
    MetaProperty prop;
    int target_flag = flag & META_FLAG_MASK;
    int all_flag = ALL & META_FLAG_MASK;

    for (int i = 0; i < meta->count; i++) {
        prop = meta->properties[i];
        if (strcmp(prop.name, prop_name) == 0) {
            if (target_flag == all_flag) {
                return prop.flag_and_index;
            } else if ((prop.flag_and_index & META_FLAG_MASK) == target_flag) {
                return prop.flag_and_index;
            }
        }
    }

    return -1;
}

/* find property type based on prop_name*/
int find_property_type(Meta *meta, char *prop_name, enum propertyFlag flag) {
    MetaProperty prop;
    int target_flag = flag & META_FLAG_MASK;
    int all_flag = ALL & META_FLAG_MASK;

    for (int i = 0; i < meta->count; i++) {
        prop = meta->properties[i];
        if (strcmp(prop.name, prop_name) == 0) {
            if (target_flag == all_flag) {
                return prop.type;
            } else if ((prop.flag_and_index & META_FLAG_MASK) == target_flag) {
                return prop.type;
            }
        }
    }

    return -1;
}
