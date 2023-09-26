/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#include "quickjs.h"
#include "type.h"

extern JSValue *
dynamic_dup_value(JSContext *ctx, JSValue value);

/******************* function fallback *******************/
dyn_value_t
dynamic_invoke(dyn_ctx_t ctx, const char *name, dyn_value_t obj, int argc,
               dyn_value_t *args)
{
    JSValue js_obj = *(JSValue *)obj;
    uint64_t total_size;
    JSValue *argv = NULL, v;
    dyn_value_t res = NULL;

    total_size = sizeof(JSValue) * argc;
    if (total_size > 0) {
        argv = js_malloc(ctx->js_ctx, total_size);
        if (!argv) {
            return NULL;
        }
    }

    for (int i = 0; i < argc; i++) {
        argv[i] = *(JSValue *)args[i];
    }

    if (name && name[0] != '\0') {
        JSClassCall *call_func = NULL;
        JSAtom atom = find_atom(ctx->js_ctx, name);
        JSValue func = JS_GetProperty(ctx->js_ctx, js_obj, atom);
        JSObject *func_obj;
        uint32_t class_id;

        if (!JS_IsFunction(ctx->js_ctx, func)) {
            JS_FreeAtom(ctx->js_ctx, atom);
            JS_FreeValue(ctx->js_ctx, func);
            return NULL;
        }

        func_obj = JS_VALUE_GET_OBJ(func);
        class_id = getClassIdFromObject(func_obj);

        call_func = getCallByClassId(ctx->js_rt, class_id);
        if (!call_func) {
            JS_FreeAtom(ctx->js_ctx, atom);
            JS_FreeValue(ctx->js_ctx, func);
            return NULL;
        }

        // flags is 0 because quickjs.c:17047
        v = call_func(ctx->js_ctx, func, js_obj, argc, argv, 0);
        JS_FreeAtom(ctx->js_ctx, atom);
        JS_FreeValue(ctx->js_ctx, func);
    }
    else {
        if (!JS_IsFunction(ctx->js_ctx, js_obj)) {
            return NULL;
        }
        v = JS_Call(ctx->js_ctx, js_obj, JS_UNDEFINED, argc, argv);
    }

    if (argv) {
        js_free(ctx->js_ctx, argv);
    }

    res = dynamic_dup_value(ctx->js_ctx, v);

    return res;
}

int
dynamic_execute_pending_jobs(dyn_ctx_t ctx)
{
    JSContext *js_ctx1;

    return JS_ExecutePendingJob(JS_GetRuntime(ctx->js_ctx), &js_ctx1);
}