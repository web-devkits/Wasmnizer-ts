/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

#ifndef __LIBDYNTYPE_EXPORT_H_
#define __LIBDYNTYPE_EXPORT_H_

#include "libdyntype.h"

#ifdef __cplusplus
extern "C" {
#endif

/*****************************************************************
*                                                                *
*                          Section 1                             *
*                                                                *
*          Interface exposed to the runtime embedder             *
*                                                                *
*****************************************************************/

/******************* Initialization and destroy *****************/

/**
 * @brief Initialize the dynamic type system context
 *
 * @return dynamic type system context if success, NULL otherwise
 */
dyn_ctx_t
dyntype_context_init();

/**
 * @brief Initialize the dynamic type system context with given options
 *
 * @note options can contain allocator functions and maybe other GC related
 * things
 *
 * @param options options to set (TBD)
 * @return dynamic type system context if success, NULL otherwise
 */
dyn_ctx_t
dyntype_context_init_with_opt(dyn_options_t *options);

/**
 * @brief Destroy the dynamic type system context
 *
 * @param ctx context to destroy
 */
void
dyntype_context_destroy(dyn_ctx_t ctx);

/**
 * @brief Bind an execution environment to libdyntype
 *
 * @param exec_env the execution environment to bind
 */
void
dyntype_context_set_exec_env(void *exec_env);

/**
 * @brief Get the execution environment bound to libdyntype
 *
 * @return the execution environment bound to libdyntype
 */
void *
dyntype_context_get_exec_env();

/**
 * @brief Set the callback dispatcher for external functions. When calling
 * dyntype_invoke API, the argument may contain external functions which may be
 * invoked later (e.g. Map.forEach). Libdyntype doesn't know how to invoke the
 * external functions since they are not raw native pointers. The callback
 * dispatcher will be used as a common wrapper for calling all external
 * functions from libdyntype, so the implementer can decide how to invoke the
 * actual function.
 *
 * @note If another callback is set, the previous one will be overwrite.
 *
 * @param callback the callback to set
 */
void
dyntype_set_callback_dispatcher(dyntype_callback_dispatcher_t callback);

/**
 * @brief Get the callback dispatcher for external functions.
 *
 * @return the callback dispatcher for external functions
 */
dyntype_callback_dispatcher_t
dyntype_get_callback_dispatcher();

/******************* event loop *******************/

/**
 * @brief execute pending jobs in micro-tasks of js runtime
 * @param ctx the dynamic type system context
 */
int
dyntype_execute_pending_jobs(dyn_ctx_t ctx);

/******************* Dumping *******************/

/**
 * @brief Dump dynamic error to stdout
 *
 * @param ctx the dynamic type system context
 */
void
dyntype_dump_error(dyn_ctx_t ctx);

/******************* Exception *******************/

/**
 * @brief Throw dynamic exception
 *
 * @param ctx the dynamic type system context
 * @param obj the dynamic exception value
 */
dyn_value_t
dyntype_throw_exception(dyn_ctx_t ctx, dyn_value_t obj);

/******************* Dumping *******************/

/**
 * @brief Dump dynamic value to stdout
 *
 * @param ctx the dynamic type system context
 * @param obj object to be dumped
 */
void
dyntype_dump_value(dyn_ctx_t ctx, dyn_value_t obj);

/**
 * @brief Dump dynamic value to given buffer
 *
 * @param ctx the dynamic type system context
 * @param obj object to be dumped
 * @param buffer buffer to store the dumped message
 * @param len length of the given buffer
 * @return On success, this function return length of bytes dumped to buffer.
 * When failed, a negative error code is returned and content in buffer is
 * undefined
 */
int
dyntype_dump_value_buffer(dyn_ctx_t ctx, dyn_value_t obj, void *buffer,
                          int len);

/******************* Garbage collection *******************/

/**
 * @brief Mark the object
 *
 * @param ctx the dynamic type system context
 * @param obj the dynamic value
 * @return On success, this function return a dyn_value_t which hold a strong
 * reference to the dynamic object, avoid this object to be claimed until this
 * dyn_value_t is freed through dyntype_release.
 */
dyn_value_t
dyntype_hold(dyn_ctx_t ctx, dyn_value_t obj);

/**
 * @brief Release the object
 *
 * @param ctx the dynamic type system context
 * @param obj the dynamic value
 */
void
dyntype_release(dyn_ctx_t ctx, dyn_value_t obj);

/**
 * @brief Start GC collect
 *
 * @param ctx the dynamic type system context
 */
void
dyntype_collect(dyn_ctx_t ctx);


#ifdef __cplusplus
}
#endif

#endif /* end of __LIBDYNTYPE_EXPORT_H_ */
