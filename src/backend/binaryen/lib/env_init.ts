/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import { dyntype, structdyn } from './dyntype/utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UtilFuncs } from '../utils.js';
import { BuiltinNames } from '../../../../lib/builtin/builtin_name.js';
import { getBuiltInFuncName } from '../../../utils.js';
import { i8ArrayTypeInfo } from '../glue/packType.js';
import { _BinaryenTypeStringref } from '../glue/binaryen.js';

export function importAnyLibAPI(module: binaryen.Module) {
    dyntype.updateValueByConfig();
    module.addFunctionImport(
        dyntype.dyntype_get_context,
        dyntype.module_name,
        dyntype.dyntype_get_context,
        binaryen.createType([]),
        dyntype.dyn_ctx_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_number,
        dyntype.module_name,
        dyntype.dyntype_new_number,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.double]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_string,
        dyntype.module_name,
        dyntype.dyntype_new_string,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_boolean,
        dyntype.module_name,
        dyntype.dyntype_new_boolean,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.bool]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_typeof,
        dyntype.module_name,
        dyntype.dyntype_typeof,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.ts_string,
    );
    module.addFunctionImport(
        dyntype.dyntype_typeof1,
        dyntype.module_name,
        dyntype.dyntype_typeof1,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_toString,
        dyntype.module_name,
        dyntype.dyntype_toString,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.ts_string,
    );
    module.addFunctionImport(
        dyntype.dyntype_type_eq,
        dyntype.module_name,
        dyntype.dyntype_type_eq,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
        ]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_number,
        dyntype.module_name,
        dyntype.dyntype_is_number,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_to_number,
        dyntype.module_name,
        dyntype.dyntype_to_number,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.double,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_undefined,
        dyntype.module_name,
        dyntype.dyntype_is_undefined,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_null,
        dyntype.module_name,
        dyntype.dyntype_is_null,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_undefined,
        dyntype.module_name,
        dyntype.dyntype_new_undefined,
        dyntype.dyn_ctx_t,
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_null,
        dyntype.module_name,
        dyntype.dyntype_new_null,
        dyntype.dyn_ctx_t,
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_object,
        dyntype.module_name,
        dyntype.dyntype_new_object,
        dyntype.dyn_ctx_t,
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_array,
        dyntype.module_name,
        dyntype.dyntype_new_array,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.int]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_add_elem,
        dyntype.module_name,
        dyntype.dyntype_add_elem,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
        ]),
        dyntype.cvoid,
    );
    module.addFunctionImport(
        dyntype.dyntype_set_elem,
        dyntype.module_name,
        dyntype.dyntype_set_elem,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.int,
            dyntype.dyn_value_t,
        ]),
        dyntype.cvoid,
    );
    module.addFunctionImport(
        dyntype.dyntype_get_elem,
        dyntype.module_name,
        dyntype.dyntype_get_elem,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.int,
        ]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_array,
        dyntype.module_name,
        dyntype.dyntype_is_array,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_set_property,
        dyntype.module_name,
        dyntype.dyntype_set_property,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.cstring,
            dyntype.dyn_value_t,
        ]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_get_property,
        dyntype.module_name,
        dyntype.dyntype_get_property,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.cstring,
        ]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_has_property,
        dyntype.module_name,
        dyntype.dyntype_has_property,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.cstring,
        ]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_delete_property,
        dyntype.module_name,
        dyntype.dyntype_delete_property,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.cstring,
        ]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_get_keys,
        dyntype.module_name,
        dyntype.dyntype_get_keys,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_extref,
        dyntype.module_name,
        dyntype.dyntype_new_extref,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.pointer,
            dyntype.external_ref_tag,
        ]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_extref,
        dyntype.module_name,
        dyntype.dyntype_is_extref,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_to_extref,
        dyntype.module_name,
        dyntype.dyntype_to_extref,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_instanceof,
        dyntype.module_name,
        dyntype.dyntype_instanceof,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
        ]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_object,
        dyntype.module_name,
        dyntype.dyntype_is_object,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_get_prototype,
        dyntype.module_name,
        dyntype.dyntype_get_prototype,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_set_prototype,
        dyntype.module_name,
        dyntype.dyntype_set_prototype,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
        ]),
        dyntype.int,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_bool,
        dyntype.module_name,
        dyntype.dyntype_is_bool,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_to_bool,
        dyntype.module_name,
        dyntype.dyntype_to_bool,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_string,
        dyntype.module_name,
        dyntype.dyntype_is_string,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_to_string,
        dyntype.module_name,
        dyntype.dyntype_to_string,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.ts_string,
    );
    module.addFunctionImport(
        dyntype.dyntype_is_falsy,
        dyntype.module_name,
        dyntype.dyntype_is_falsy,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.dyn_value_t]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_cmp,
        dyntype.module_name,
        dyntype.dyntype_cmp,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
            dyntype.int,
        ]),
        dyntype.bool,
    );
    module.addFunctionImport(
        dyntype.dyntype_new_object_with_class,
        dyntype.module_name,
        dyntype.dyntype_new_object_with_class,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.pointer,
            dyntype.dyn_value_t,
        ]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_invoke,
        dyntype.module_name,
        dyntype.dyntype_invoke,
        binaryen.createType([
            dyntype.dyn_ctx_t,
            dyntype.pointer,
            dyntype.dyn_value_t,
            dyntype.dyn_value_t,
        ]),
        dyntype.dyn_value_t,
    );
    module.addFunctionImport(
        dyntype.dyntype_get_global,
        dyntype.module_name,
        dyntype.dyntype_get_global,
        binaryen.createType([dyntype.dyn_ctx_t, dyntype.pointer]),
        dyntype.dyn_value_t,
    );
}

export function importInfcLibAPI(module: binaryen.Module) {
    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_i32,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_i32,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.i32,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_i64,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_i64,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.i64,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_f32,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_f32,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.f32,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_f64,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_f64,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.f64,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_anyref,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_anyref,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.anyref,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_get_indirect_funcref,
        structdyn.module_name,
        structdyn.StructDyn.struct_get_indirect_funcref,
        binaryen.createType([binaryen.anyref, binaryen.i32]),
        binaryen.funcref,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_i32,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_i32,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.i32]),
        binaryen.none,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_i64,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_i64,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.i64]),
        binaryen.none,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_f32,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_f32,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.f32]),
        binaryen.none,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_f64,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_f64,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.f64]),
        binaryen.none,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_anyref,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_anyref,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.anyref]),
        binaryen.none,
    );

    module.addFunctionImport(
        structdyn.StructDyn.struct_set_indirect_funcref,
        structdyn.module_name,
        structdyn.StructDyn.struct_set_indirect_funcref,
        binaryen.createType([binaryen.anyref, binaryen.i32, binaryen.funcref]),
        binaryen.none,
    );
}

export function generateGlobalContext(module: binaryen.Module) {
    module.addGlobal(
        dyntype.dyntype_context,
        dyntype.dyn_ctx_t,
        true,
        module.ref.null(dyntype.dyn_ctx_t),
    );
}

export function generateGlobalJSObject(module: binaryen.Module, name: string) {
    module.addGlobal(
        name,
        dyntype.dyn_value_t,
        true,
        module.ref.null(dyntype.dyn_value_t),
    );
}

export function generateExtRefTableMaskArr(module: binaryen.Module) {
    const name = getBuiltInFuncName(BuiltinNames.extRefTableMaskArr);
    module.addGlobal(
        name,
        i8ArrayTypeInfo.typeRef,
        true,
        module.ref.null(dyntype.dyn_ctx_t),
    );
}

export function generateDynContext(module: binaryen.Module) {
    const initDynContextStmt = module.global.set(
        dyntype.dyntype_context,
        module.call(dyntype.dyntype_get_context, [], binaryen.none),
    );

    return initDynContextStmt;
}

export function addItableFunc(module: binaryen.Module) {
    /* add customize function from .wat *
    /* TODO: Have not found an effiective way to load import function from .wat yet */
    module.addFunctionImport(
        'strcmp',
        'env',
        'strcmp',
        binaryen.createType([binaryen.i32, binaryen.i32]),
        binaryen.i32,
    );
    const itableFilePath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'interface',
        'meta.wat',
    );
    const itableLib = fs.readFileSync(itableFilePath, 'utf-8');
    const watModule = binaryen.parseText(itableLib);
    UtilFuncs.addWatFuncs(
        watModule,
        BuiltinNames.findPropertyFlagAndIndex,
        module,
    );
    module.addFunctionExport(
        BuiltinNames.findPropertyFlagAndIndex,
        BuiltinNames.findPropertyFlagAndIndex,
    );
    UtilFuncs.addWatFuncs(watModule, BuiltinNames.findPropertyType, module);
    watModule.dispose();
}
