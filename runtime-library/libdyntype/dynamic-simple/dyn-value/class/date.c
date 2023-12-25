/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "dyn_class.h"
#include <time.h>

/**
 * @brief char* to time_t
 *
 * @param str year-month-day hour:minute:second, like
 * "2023-12-23 15:58:12"
 * @param t time_t addr
 * @return int 0: success
 */
int
strtotime(const char *str, time_t *t)
{

    int year, month, day, hour, minute, second;
    struct tm tm_;

    if (sscanf(str, "%d-%d-%d %d:%d:%d", &year, &month, &day, &hour, &minute,
               &second)
        != 6) {
        return -1;
    }
    if (hour < 0 || hour > 23) {
        return -1;
    }
    tm_.tm_hour = hour;

    if (minute < 0 || minute > 59) {
        return -1;
    }
    tm_.tm_min = minute;

    if (second < 0 || second > 59) {
        return -1;
    }
    tm_.tm_sec = second;

    tm_.tm_year = year - 1900;
    tm_.tm_mon = month - 1;
    tm_.tm_mday = day;
    tm_.tm_isdst = 0;
    *t = mktime(&tm_);

    if (*t == -1)
        return -1;

    return 0;
}

/* Constructor (new Date()) */
DynValue *
date_constructor(int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj =
        (DyntypeDate *)wasm_runtime_malloc(sizeof(DyntypeDate));
    if (!dyn_obj) {
        return NULL;
    }

    if (!init_dyn_object((DyntypeObject *)dyn_obj, DynClassDate)) {
        wasm_runtime_free(dyn_obj);
        return NULL;
    }

    if (argc == 0) {
        dyn_obj->time = time(NULL);
    }
    else if (argc == 1 && argv[0]->class_id == DynClassString) {
        DyntypeString *str = (DyntypeString *)argv[0];
        if (strtotime(str->data, &dyn_obj->time) != 0) {
            return NULL;
        }
    }
    return (DynValue *)dyn_obj;
}

DynValue *
date_get_full_year(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));

    return dyn_value_new_number((double)(1900 + timeval->tm_year));
}

DynValue *
date_get_month(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_mon));
}

DynValue *
date_get_date(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_mday));
}

DynValue *
date_get_day(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_wday));
}

DynValue *
date_get_hours(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_hour));
}

DynValue *
date_get_minutes(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_min));
}

DynValue *
date_get_seconds(DynValue *this_val, int argc, DynValue *argv[])
{
    DyntypeDate *dyn_obj = (DyntypeDate *)this_val;
    struct tm *timeval = localtime(&(dyn_obj->time));
    return dyn_value_new_number((double)(timeval->tm_sec));
}

/* Date.prototype.xxx */
ClassMethod date_instance_methods[] = {
    { "getFullYear", date_get_full_year },
    { "getMonth", date_get_month },
    { "getDate", date_get_date },
    { "getDay", date_get_day },
    { "getHours", date_get_hours },
    { "getMinutes", date_get_minutes },
    { "getSeconds", date_get_seconds },
};

DynValue *
date_now(DynValue *this_val, int argc, DynValue *argv[])
{
    // get unix timestamp
    struct timeval start;
    gettimeofday(&start, NULL);
    return dyn_value_new_number(
        (double)(start.tv_sec * 1000 + start.tv_usec / 1000));
}

/* Date.xxx */
ClassMethod date_class_methods[] = { { "now", date_now } };

ClassMeta date_class_meta = {
    .constructor = date_constructor,
    .parent_class_id = DynClassObject,
    .inst_method_num = sizeof(date_instance_methods) / sizeof(ClassMethod),
    .inst_methods = date_instance_methods,
    .class_method_num = sizeof(date_class_methods) / sizeof(ClassMethod),
    .class_methods = date_class_methods,
    .name = "Date"
};

/* Date, never free this object */
DyntypeClass date_class = {
    .base = {
        .header = {
            .type = DynObject,
            .class_id = DynClassConstructor,
            .ref_count = 1,
        },
        .properties = NULL,
    },
    .meta = &date_class_meta,
};
