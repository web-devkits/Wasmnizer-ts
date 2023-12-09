/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import binaryen from 'binaryen';
import * as binaryenCAPI from './glue/binaryen.js';
import {
    builtinClosureType,
    arrayToPtr,
    emptyStructType,
    generateArrayStructTypeInfo,
    StringRefMeatureOp,
    baseStructType,
} from './glue/transform.js';
import { assert } from 'console';
import { WASMGen } from './index.js';
import { Logger } from '../../log.js';
import {
    UtilFuncs,
    FunctionalFuncs,
    ItableFlag,
    FlattenLoop,
    MetaDataOffset,
    BackendLocalVar,
} from './utils.js';
import {
    PredefinedTypeId,
    getUtilsFuncName,
    processEscape,
} from '../../utils.js';
import {
    BinaryExprValue,
    BlockBranchIfValue,
    BlockBranchValue,
    BlockValue,
    CastValue,
    ClosureCallValue,
    ConditionExprValue,
    DirectCallValue,
    DirectGetValue,
    DirectGetterValue,
    DirectSetterValue,
    DynamicCallValue,
    DynamicGetValue,
    DynamicSetValue,
    ElementGetValue,
    ElementSetValue,
    FunctionCallValue,
    LiteralValue,
    NewArrayLenValue,
    NewArrayValue,
    NewClosureFunction,
    NewLiteralArrayValue,
    NewLiteralObjectValue,
    OffsetGetValue,
    OffsetSetValue,
    PostUnaryExprValue,
    PrefixUnaryExprValue,
    SemanticsValue,
    SemanticsValueKind,
    ShapeCallValue,
    ShapeGetValue,
    ShapeSetValue,
    SuperValue,
    VarValue,
    OffsetCallValue,
    VTableCallValue,
    TypeofValue,
    ToStringValue,
    AnyCallValue,
    SuperUsageFlag,
    CommaExprValue,
    ReBindingValue,
    SpreadValue,
    TemplateExprValue,
    EnumerateKeysGetValue,
    VTableGetValue,
    VTableSetValue,
} from '../../semantics/value.js';
import {
    ArrayType,
    ClosureContextType,
    FunctionType,
    ObjectType,
    ObjectTypeFlag,
    Primitive,
    PrimitiveType,
    TypeParameterType,
    UnionType,
    ValueType,
    ValueTypeKind,
    ValueTypeWithArguments,
} from '../../semantics/value_types.js';
import { UnimplementError } from '../../error.js';
import {
    FunctionDeclareNode,
    SemanticsKind,
    VarDeclareNode,
} from '../../semantics/semantics_nodes.js';
import {
    MemberDescription,
    MemberType,
    ObjectDescription,
    ObjectDescriptionType,
} from '../../semantics/runtime.js';
import { NewConstructorObjectValue } from '../../semantics/value.js';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import { dyntype, structdyn } from './lib/dyntype/utils.js';
import {
    anyArrayTypeInfo,
    stringArrayStructTypeInfo,
    stringrefArrayStructTypeInfo,
    stringArrayTypeInfo,
    stringrefArrayTypeInfo,
} from './glue/packType.js';
import { getBuiltInFuncName } from '../../utils.js';
import { stringTypeInfo } from './glue/packType.js';
import { getConfig } from '../../../config/config_mgr.js';
import { GetBuiltinObjectType } from '../../semantics/builtin.js';

export class WASMExpressionGen {
    private module: binaryen.Module;
    private wasmTypeGen;

    constructor(private wasmCompiler: WASMGen) {
        this.module = this.wasmCompiler.module;
        this.wasmTypeGen = this.wasmCompiler.wasmTypeComp;
    }

    wasmExprGen(value: SemanticsValue): binaryen.ExpressionRef {
        this.module = this.wasmCompiler.module;
        this.wasmTypeGen = this.wasmCompiler.wasmTypeComp;

        switch (value.kind) {
            case SemanticsValueKind.SUPER:
                return this.wasmSuper(<SuperValue>value);
            case SemanticsValueKind.LITERAL:
                return this.wasmLiteral(<LiteralValue>value);
            case SemanticsValueKind.PARAM_VAR:
            case SemanticsValueKind.LOCAL_VAR:
            case SemanticsValueKind.LOCAL_CONST:
            case SemanticsValueKind.GLOBAL_VAR:
            case SemanticsValueKind.GLOBAL_CONST:
            case SemanticsValueKind.CLOSURE_VAR:
            case SemanticsValueKind.CLOSURE_CONST:
                return this.wasmGetValue(<VarValue>value);
            case SemanticsValueKind.NEW_CLOSURE_FUNCTION:
                return this.wasmGetClosure(<NewClosureFunction>value);
            case SemanticsValueKind.BINARY_EXPR:
                return this.wasmBinaryExpr(<BinaryExprValue>value);
            case SemanticsValueKind.COMMA_EXPR:
                return this.wasmCommaExpr(<CommaExprValue>value);
            case SemanticsValueKind.POST_UNARY_EXPR:
                return this.wasmPostUnaryExpr(<PostUnaryExprValue>value);
            case SemanticsValueKind.PRE_UNARY_EXPR:
                return this.wasmPreUnaryExpr(<PrefixUnaryExprValue>value);
            case SemanticsValueKind.CONDITION_EXPR:
                return this.wasmConditionalExpr(<ConditionExprValue>value);
            case SemanticsValueKind.OFFSET_CALL:
                return this.wasmOffsetCall(<OffsetCallValue>value);
            case SemanticsValueKind.DIRECT_CALL:
                return this.wasmDirectCall(<DirectCallValue>value);
            case SemanticsValueKind.FUNCTION_CALL:
                return this.wasmFunctionCall(<FunctionCallValue>value);
            case SemanticsValueKind.ENUMERATE_KEY_GET:
                return this.wasmEnumerateKeysGet(<EnumerateKeysGetValue>value);
            case SemanticsValueKind.CLOSURE_CALL:
                return this.wasmClosureCall(<ClosureCallValue>value);
            case SemanticsValueKind.DYNAMIC_CALL:
                return this.wasmDynamicCall(<DynamicCallValue>value);
            case SemanticsValueKind.VTABLE_CALL:
                return this.wasmVtableCall(<VTableCallValue>value);
            case SemanticsValueKind.ANY_CALL:
                return this.wasmAnyCall(<AnyCallValue>value);
            case SemanticsValueKind.ANY_CAST_VALUE:
            case SemanticsValueKind.VALUE_CAST_ANY:
            case SemanticsValueKind.VALUE_CAST_UNION:
            case SemanticsValueKind.UNION_CAST_VALUE:
            case SemanticsValueKind.OBJECT_CAST_ANY:
            case SemanticsValueKind.OBJECT_CAST_UNION:
            case SemanticsValueKind.UNION_CAST_OBJECT:
            case SemanticsValueKind.UNION_CAST_ANY:
            case SemanticsValueKind.ANY_CAST_OBJECT:
            case SemanticsValueKind.OBJECT_CAST_VALUE:
                return this.wasmAnyCast(<CastValue>value);
            case SemanticsValueKind.VALUE_CAST_VALUE:
                return this.wasmValueCast(<CastValue>value);
            case SemanticsValueKind.SHAPE_SET:
                return this.wasmObjFieldSet(<ShapeSetValue>value);
            case SemanticsValueKind.OFFSET_SET:
                return this.wasmObjFieldSet(<OffsetSetValue>value);
            case SemanticsValueKind.VTABLE_SET:
                return this.wasmObjFieldSet(<VTableSetValue>value);
            case SemanticsValueKind.NEW_LITERAL_OBJECT:
                return this.wasmNewLiteralObj(<NewLiteralObjectValue>value);
            case SemanticsValueKind.OBJECT_CAST_OBJECT:
                return this.wasmObjCast(<CastValue>value);
            case SemanticsValueKind.NEW_CONSTRCTOR_OBJECT:
                return this.wasmNewClass(<NewConstructorObjectValue>value);
            case SemanticsValueKind.SHAPE_GET:
                return this.wasmObjFieldGet(<ShapeGetValue>value);
            case SemanticsValueKind.DIRECT_GET:
                return this.wasmObjFieldGet(<DirectGetValue>value);
            case SemanticsValueKind.OFFSET_GETTER:
            case SemanticsValueKind.OFFSET_GET:
                return this.wasmObjFieldGet(<OffsetGetValue>value);
            case SemanticsValueKind.VTABLE_GET:
                return this.wasmObjFieldGet(<VTableGetValue>value);
            case SemanticsValueKind.DYNAMIC_GET:
                return this.wasmDynamicGet(<DynamicGetValue>value);
            case SemanticsValueKind.DYNAMIC_SET:
                return this.wasmDynamicSet(<DynamicSetValue>value);
            case SemanticsValueKind.NEW_LITERAL_ARRAY:
                return this.wasmNewLiteralArray(<NewLiteralArrayValue>value);
            case SemanticsValueKind.ARRAY_INDEX_GET:
            case SemanticsValueKind.OBJECT_KEY_GET:
            case SemanticsValueKind.STRING_INDEX_GET:
                return this.wasmElemGet(<ElementGetValue>value);
            case SemanticsValueKind.ARRAY_INDEX_SET:
            case SemanticsValueKind.OBJECT_KEY_SET:
            case SemanticsValueKind.STRING_INDEX_SET:
                return this.wasmElemSet(<ElementSetValue>value);
            case SemanticsValueKind.BLOCK:
                return this.wasmBlockValue(<BlockValue>value);
            case SemanticsValueKind.BLOCK_BRANCH_IF:
                return this.wasmBlockIFValue(<BlockBranchIfValue>value);
            case SemanticsValueKind.BLOCK_BRANCH:
                return this.wasmBlockBranchValue(<BlockBranchValue>value);
            case SemanticsValueKind.SHAPE_CALL:
                return this.wasmShapeCall(<ShapeCallValue>value);
            case SemanticsValueKind.DIRECT_GETTER:
                return this.wasmDirectGetter(<DirectGetterValue>value);
            case SemanticsValueKind.DIRECT_SETTER:
                return this.wasmDirectSetter(<DirectSetterValue>value);
            case SemanticsValueKind.NEW_ARRAY:
            case SemanticsValueKind.NEW_ARRAY_LEN:
                return this.wasmNewArray(
                    <NewArrayValue | NewArrayLenValue>value,
                );
            case SemanticsValueKind.TYPEOF:
                return this.wasmTypeof(<TypeofValue>value);
            case SemanticsValueKind.TEMPLATE_EXPRESSION:
                return this.wasmTemplateExpr(<TemplateExprValue>value);
            case SemanticsValueKind.VALUE_TO_STRING:
            case SemanticsValueKind.OBJECT_TO_STRING:
                return this.wasmToString(<ToStringValue>value);
            case SemanticsValueKind.REBINDING:
                return this.wasmReBinding(<ReBindingValue>value);
            case SemanticsValueKind.SPREAD:
                return this.wasmSpread(<SpreadValue>value);
            default:
                throw new UnimplementError(`unexpected value: ${value}`);
        }
    }

    private wasmSuper(value: SuperValue): binaryen.ExpressionRef {
        if (value.usageFlag == SuperUsageFlag.SUPER_CALL) {
            const constructor = value.shape?.meta.name + '|constructor';
            const metaInfo = (value.type as ObjectType).meta;
            const ctorFuncDecl = (
                metaInfo.ctor!.methodOrAccessor!.method! as VarValue
            ).ref as FunctionDeclareNode;
            const thisRef = this.module.local.get(1, emptyStructType.typeRef);
            return this.module.drop(
                this.callFunc(
                    metaInfo.ctor!.valueType as FunctionType,
                    constructor,
                    binaryen.none,
                    value.parameters,
                    ctorFuncDecl,
                    undefined,
                    thisRef,
                ),
            );
        } else {
            return this.module.local.get(1, emptyStructType.typeRef);
        }
    }

    private wasmLiteral(value: LiteralValue): binaryen.ExpressionRef {
        switch (value.type.kind) {
            case ValueTypeKind.NUMBER: {
                return this.module.f64.const(value.value as number);
            }
            case ValueTypeKind.BOOLEAN: {
                const literalValue = value.value as boolean;
                if (literalValue) {
                    return this.module.i32.const(1);
                } else {
                    return this.module.i32.const(0);
                }
            }
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING: {
                if (getConfig().enableStringRef) {
                    return this.createStringRef(value.value as string);
                } else {
                    return FunctionalFuncs.generateStringForStructArrayStr(
                        this.module,
                        value.value as string,
                    );
                }
            }
            case ValueTypeKind.NULL: {
                return this.module.ref.null(
                    binaryenCAPI._BinaryenTypeStructref(),
                );
            }
            case ValueTypeKind.UNDEFINED: {
                /* Currently, we treat undefined as any */
                return FunctionalFuncs.generateDynUndefined(this.module);
            }
            case ValueTypeKind.INT: {
                return this.module.i32.const(value.value as number);
            }
            case ValueTypeKind.WASM_I64: {
                // TODO: split value.value as two i32 values, put into low and high
                return this.module.i64.const(value.value as number, 0);
            }
            case ValueTypeKind.WASM_F32: {
                return this.module.f32.const(value.value as number);
            }
            default: {
                throw new UnimplementError(`TODO: wasmLiteral: ${value}`);
            }
        }
    }

    private createStringRef(value: string): binaryen.ExpressionRef {
        const ptr = this.wasmCompiler.generateRawString(value);
        const len = UtilFuncs.utf16ToUtf8(value).length;
        return FunctionalFuncs.generateStringForStringref(
            this.module,
            this.module.i32.const(ptr),
            this.module.i32.const(len),
        );
    }

    private encodeStringrefToLinearMemory(stringref: binaryen.ExpressionRef) {
        const storeInMemoryStmts: binaryen.ExpressionRef[] = [];
        /* measure str length */
        const propStrLen = binaryenCAPI._BinaryenStringMeasure(
            this.module.ptr,
            StringRefMeatureOp.UTF8,
            stringref,
        );
        /* encode str to memory */
        const memoryReserveOffsetRef = this.module.i32.const(
            BuiltinNames.memoryReserveOffset,
        );
        const codeunits = binaryenCAPI._BinaryenStringEncode(
            this.module.ptr,
            StringRefMeatureOp.WTF8,
            stringref,
            memoryReserveOffsetRef,
            0,
        );
        /* add end to memory */
        storeInMemoryStmts.push(
            this.module.i32.store(
                0,
                4,
                this.module.i32.add(memoryReserveOffsetRef, codeunits),
                this.module.i32.const(0),
            ),
        );
        this.wasmCompiler.currentFuncCtx!.insert(
            this.module.if(
                this.module.i32.lt_s(
                    propStrLen,
                    this.module.i32.const(BuiltinNames.memoryReserveMaxSize),
                ),
                this.module.block(null, storeInMemoryStmts),
                this.module.unreachable(),
            ),
        );
        return memoryReserveOffsetRef;
    }

    private getStringOffset(value: string): binaryen.ExpressionRef {
        return this.module.i32.const(
            this.wasmCompiler.generateRawString(value),
        );
    }

    private wasmGetValue(value: VarValue): binaryen.ExpressionRef {
        const varNode = value.ref;
        const varTypeRef = this.wasmTypeGen.getWASMValueType(value.type);
        /** when meeting a ValueType as value, return wasm type */
        if (value.ref instanceof ValueType) {
            return varTypeRef;
        }
        switch (value.kind) {
            case SemanticsValueKind.PARAM_VAR:
            case SemanticsValueKind.LOCAL_VAR:
            case SemanticsValueKind.LOCAL_CONST: {
                const varDeclNode = varNode as VarDeclareNode;
                if (varDeclNode.isUsedInClosureFunction()) {
                    const currCtx = varDeclNode.curCtx;
                    const belongCtx = varDeclNode.belongCtx;

                    if (!currCtx || !belongCtx) {
                        throw new Error(
                            `get value failed in getting context of closure, varNode is ${varDeclNode.name}`,
                        );
                    }
                    let currCtxType = currCtx.type as ClosureContextType;
                    const belongCtxType = belongCtx.type as ClosureContextType;
                    let contextTypeRef =
                        this.wasmTypeGen.getWASMType(currCtxType);
                    let contextRef = this.module.local.get(
                        currCtx.index,
                        contextTypeRef,
                    );
                    while (currCtxType != belongCtxType) {
                        if (currCtxType.freeVarTypeList.length !== 0) {
                            contextRef = binaryenCAPI._BinaryenStructGet(
                                this.module.ptr,
                                0,
                                contextRef,
                                contextTypeRef,
                                false,
                            );
                        }

                        currCtxType = currCtxType.parentCtxType!;
                        contextTypeRef =
                            this.wasmTypeGen.getWASMType(currCtxType);
                    }

                    return binaryenCAPI._BinaryenStructGet(
                        this.module.ptr,
                        varDeclNode!.closureIndex! + 1,
                        contextRef,
                        contextTypeRef,
                        false,
                    );
                } else {
                    return this.module.local.get(varNode.index, varTypeRef);
                }
            }
            case SemanticsValueKind.GLOBAL_VAR:
            case SemanticsValueKind.GLOBAL_CONST: {
                if (varNode instanceof VarDeclareNode) {
                    if (varNode.name === BuiltinNames.nanName) {
                        return this.module.f64.const(NaN);
                    } else if (varNode.name === BuiltinNames.infinityName) {
                        return this.module.f64.const(Infinity);
                    } else if (
                        varNode.name.includes(
                            BuiltinNames.builtinTypeManglePrefix,
                        )
                    ) {
                        const fallbackTypeName = varNode.name.substring(
                            varNode.name.indexOf(
                                BuiltinNames.builtinTypeManglePrefix,
                            ),
                        );
                        if (
                            !BuiltinNames.fallbackGlobalNames.includes(
                                fallbackTypeName,
                            )
                        ) {
                            throw new UnimplementError(
                                `type ${fallbackTypeName} doesn't exist in fallback type names`,
                            );
                        }
                        const origName = varNode.name.split(
                            BuiltinNames.moduleDelimiter,
                        )[1];
                        BuiltinNames.JSGlobalObjects.add(origName);
                        return this.module.global.get(
                            origName,
                            binaryen.anyref,
                        );
                    }
                    return this.module.global.get(varNode.name, varTypeRef);
                } else if (varNode instanceof FunctionDeclareNode) {
                    return this.createClosureStruct(varNode);
                } else {
                    throw new UnimplementError(
                        `need to handle global var in wasmGetVar: ${value}`,
                    );
                }
            }
            default:
                throw new UnimplementError(
                    `Need to handle ${value.kind} in wasmGetVar`,
                );
        }
    }

    private wasmGetClosure(value: NewClosureFunction): binaryen.ExpressionRef {
        return this.createClosureStruct(value.funcNode);
    }

    private createClosureStruct(funcNode: FunctionDeclareNode) {
        const funcTypeRef = this.wasmTypeGen.getWASMType(funcNode.funcType);
        const closureStructHeapTypeRef = this.wasmTypeGen.getWASMValueHeapType(
            funcNode.funcType,
        );
        const closureContextRef = funcNode.parentCtx
            ? this.module.local.get(
                  funcNode.parentCtx.index,
                  this.wasmTypeGen.getWASMValueType(funcNode.parentCtx.type),
              )
            : this.wasmCompiler.emptyRef;
        const closureStruct = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([
                closureContextRef,
                this.wasmCompiler.emptyRef,
                this.module.ref.func(funcNode.name, funcTypeRef),
            ]).ptr,
            3,
            closureStructHeapTypeRef,
        );
        return closureStruct;
    }

    private wasmSetValue(
        value: VarValue,
        targetValue: SemanticsValue,
    ): binaryen.ExpressionRef {
        const varNode = value.ref as VarDeclareNode;
        const targetValueRef = this.wasmExprGen(targetValue);
        switch (value.kind) {
            case SemanticsValueKind.PARAM_VAR:
            case SemanticsValueKind.LOCAL_VAR:
            case SemanticsValueKind.LOCAL_CONST: {
                if (varNode.isUsedInClosureFunction()) {
                    const currCtx = varNode.curCtx;
                    const belongCtx = varNode.belongCtx;
                    if (!currCtx || !belongCtx) {
                        throw new Error(
                            `set value failed in getting context of closure, varNode is ${varNode.name}`,
                        );
                    }
                    let currCtxType = currCtx.type as ClosureContextType;
                    const belongCtxType = belongCtx.type as ClosureContextType;
                    let contextTypeRef =
                        this.wasmTypeGen.getWASMType(currCtxType);
                    let contextRef = this.module.local.get(
                        currCtx.index,
                        contextTypeRef,
                    );
                    while (currCtxType != belongCtxType) {
                        if (currCtxType.freeVarTypeList.length !== 0) {
                            contextRef = binaryenCAPI._BinaryenStructGet(
                                this.module.ptr,
                                0,
                                contextRef,
                                contextTypeRef,
                                false,
                            );
                        }

                        currCtxType = currCtxType.parentCtxType!;
                        contextTypeRef =
                            this.wasmTypeGen.getWASMType(currCtxType);
                    }
                    return binaryenCAPI._BinaryenStructSet(
                        this.module.ptr,
                        varNode.closureIndex! + 1,
                        contextRef,
                        targetValueRef,
                    );
                } else {
                    return this.module.local.set(varNode.index, targetValueRef);
                }
            }
            case SemanticsValueKind.GLOBAL_VAR:
            case SemanticsValueKind.GLOBAL_CONST:
                return this.module.global.set(varNode.name, targetValueRef);
            default:
                throw new UnimplementError(
                    `Need to handle ${value.kind} in wasmSetVar`,
                );
        }
    }

    private wasmBinaryExpr(value: BinaryExprValue): binaryen.ExpressionRef {
        const opKind = value.opKind;
        const leftValue = value.left;
        const rightValue = value.right;
        switch (opKind) {
            case ts.SyntaxKind.EqualsToken: {
                return this.assignBinaryExpr(leftValue, rightValue);
            }
            case ts.SyntaxKind.InstanceOfKeyword: {
                return this.wasmInstanceOf(leftValue, rightValue);
            }
            default: {
                return this.operateBinaryExpr(leftValue, rightValue, opKind);
            }
        }
    }

    private wasmCommaExpr(value: CommaExprValue): binaryen.ExpressionRef {
        const exprs: binaryen.ExpressionRef[] = [];
        for (const expr of value.exprs) {
            exprs.push(this.wasmExprGen(expr));
        }

        return this.module.block(null, exprs);
    }

    private wasmAnyGen(expr: SemanticsValue): binaryen.ExpressionRef {
        /* TODO */
        return binaryen.unreachable;
    }

    operateBinaryExpr(
        leftValue: SemanticsValue,
        rightValue: SemanticsValue,
        opKind: ts.BinaryOperator,
    ): binaryen.ExpressionRef {
        const leftValueType = leftValue.type;
        const leftValueRef = this.wasmExprGen(leftValue);
        const leftRefType = binaryen.getExpressionType(leftValueRef);
        const rightValueType = rightValue.type;
        const rightValueRef = this.wasmExprGen(rightValue);
        const rightRefType = binaryen.getExpressionType(rightValueRef);
        if (
            leftValueType.kind === ValueTypeKind.NUMBER &&
            rightValueType.kind === ValueTypeKind.NUMBER
        ) {
            return FunctionalFuncs.operateF64F64(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.INT &&
            rightValueType.kind === ValueTypeKind.INT
        ) {
            return FunctionalFuncs.operateI32I32(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.WASM_I64 &&
            rightValueType.kind === ValueTypeKind.WASM_I64
        ) {
            return FunctionalFuncs.operateI64I64(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.WASM_F32 &&
            rightValueType.kind === ValueTypeKind.WASM_F32
        ) {
            return FunctionalFuncs.operateF32F32(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.NUMBER &&
            (rightValueType.kind === ValueTypeKind.BOOLEAN ||
                rightValueType.kind === ValueTypeKind.INT)
        ) {
            return FunctionalFuncs.operateF64I32(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.BOOLEAN &&
            rightValueType.kind === ValueTypeKind.NUMBER
        ) {
            return FunctionalFuncs.operateI32F64(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            leftValueType.kind === ValueTypeKind.BOOLEAN &&
            rightValueType.kind === ValueTypeKind.BOOLEAN
        ) {
            return FunctionalFuncs.operateI32I32(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            FunctionalFuncs.treatAsAny(leftValueType.kind) &&
            FunctionalFuncs.treatAsAny(rightValueType.kind)
        ) {
            /* any will be cast to real type when running, now only number is considered */
            return FunctionalFuncs.operateAnyAny(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            (leftValueType.kind === ValueTypeKind.STRING ||
                leftValueType.kind === ValueTypeKind.RAW_STRING) &&
            (rightValueType.kind === ValueTypeKind.STRING ||
                rightValueType.kind === ValueTypeKind.RAW_STRING)
        ) {
            return FunctionalFuncs.operateStringString(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }
        if (
            (leftValueType.kind === ValueTypeKind.NULL ||
                leftValueType.kind === ValueTypeKind.UNDEFINED) &&
            !FunctionalFuncs.treatAsAny(rightValueType.kind)
        ) {
            return FunctionalFuncs.operateStaticNullUndefined(
                this.module,
                rightValueType,
                rightValueRef,
                leftValueType.kind,
                opKind,
            );
        }
        if (
            (rightValueType.kind === ValueTypeKind.NULL ||
                rightValueType.kind === ValueTypeKind.UNDEFINED) &&
            !FunctionalFuncs.treatAsAny(leftValueType.kind)
        ) {
            return FunctionalFuncs.operateStaticNullUndefined(
                this.module,
                leftValueType,
                leftValueRef,
                rightValueType.kind,
                opKind,
            );
        }
        /** static any*/
        if (
            FunctionalFuncs.treatAsAny(leftValueType.kind) &&
            !FunctionalFuncs.treatAsAny(rightValueType.kind)
        ) {
            return FunctionalFuncs.operatorAnyStatic(
                this.module,
                leftValueRef,
                rightValueRef,
                rightValueType,
                opKind,
            );
        }
        /** static any*/
        if (
            !FunctionalFuncs.treatAsAny(leftValueType.kind) &&
            FunctionalFuncs.treatAsAny(rightValueType.kind)
        ) {
            return FunctionalFuncs.operatorAnyStatic(
                this.module,
                rightValueRef,
                leftValueRef,
                leftValueType,
                opKind,
            );
        }
        // iff array, class or interface
        if (
            (leftValueType.kind === ValueTypeKind.ARRAY &&
                rightValueType.kind === ValueTypeKind.ARRAY) ||
            (leftValueType instanceof ObjectType &&
                rightValueType instanceof ObjectType)
        ) {
            return FunctionalFuncs.operateRefRef(
                this.module,
                leftValueRef,
                rightValueRef,
                opKind,
            );
        }

        throw new UnimplementError(
            `unsupported operation between ${leftValueType} and ${rightValueType}`,
        );
    }

    private assignBinaryExpr(
        leftValue: SemanticsValue,
        rightValue: SemanticsValue,
    ): binaryen.ExpressionRef {
        if (leftValue instanceof VarValue) {
            return this.wasmSetValue(leftValue, rightValue);
        } else if (leftValue instanceof ShapeSetValue) {
            return this.wasmObjFieldSet(leftValue, rightValue);
        } else if (
            leftValue instanceof OffsetSetValue ||
            leftValue instanceof OffsetGetValue
        ) {
            return this.wasmObjFieldSet(leftValue, rightValue);
        } else {
            throw new UnimplementError(`assignBinaryExpr ${leftValue}`);
        }
    }

    private wasmPostUnaryExpr(
        value: PostUnaryExprValue,
    ): binaryen.ExpressionRef {
        if (!value.flattenExprValue) {
            throw new UnimplementError(`wasmPostUnaryExpr: ${value.opKind}`);
        }
        const unaryOp = this.wasmExprGen(
            value.flattenExprValue as BinaryExprValue,
        );
        const getValueOp = this.wasmExprGen(value.target);
        let getOriValueOp = binaryen.none;
        const opKind = value.opKind;
        switch (opKind) {
            case ts.SyntaxKind.PlusPlusToken: {
                getOriValueOp = this.module.f64.sub(
                    getValueOp,
                    this.module.f64.const(1),
                );
                break;
            }
            case ts.SyntaxKind.MinusMinusToken: {
                getOriValueOp = this.module.f64.add(
                    getValueOp,
                    this.module.f64.const(1),
                );
                break;
            }
        }
        return this.module.block(null, [unaryOp, getOriValueOp]);
    }

    private wasmPreUnaryExpr(
        value: PrefixUnaryExprValue,
    ): binaryen.ExpressionRef {
        const opKind = value.opKind;
        switch (opKind) {
            case ts.SyntaxKind.PlusPlusToken:
            case ts.SyntaxKind.MinusMinusToken: {
                if (!value.flattenExprValue) {
                    throw new UnimplementError(
                        `wasmPreUnaryExpr: ${value.opKind}`,
                    );
                }
                const unaryOp = this.wasmExprGen(
                    value.flattenExprValue as BinaryExprValue,
                );
                const getValueOp = this.wasmExprGen(value.target);
                return this.module.block(
                    null,
                    [unaryOp, getValueOp],
                    binaryen.f64,
                );
            }
            case ts.SyntaxKind.ExclamationToken: {
                const operandValueRef = this.wasmExprGen(value.target);
                let result = FunctionalFuncs.generateCondition(
                    this.module,
                    operandValueRef,
                    value.type.kind,
                );
                result = this.module.i32.eqz(result);
                if (value.type.kind === ValueTypeKind.NUMBER) {
                    /* Workaround: semantic tree treat result of !number
                        as number, so we convert it back to number */
                    result = this.module.f64.convert_u.i32(result);
                }
                return result;
            }
            case ts.SyntaxKind.MinusToken: {
                if (!value.flattenExprValue) {
                    throw new UnimplementError(
                        `wasmPreUnaryExpr: ${value.opKind}`,
                    );
                }
                return this.wasmExprGen(value.flattenExprValue);
            }
            case ts.SyntaxKind.PlusToken: {
                return this.wasmExprGen(value.target);
            }
            default:
                throw new UnimplementError('wasmPreUnaryExpr: ${opKind}');
        }
    }

    private wasmConditionalExpr(
        value: ConditionExprValue,
    ): binaryen.ExpressionRef {
        let condValueRef = this.wasmExprGen(value.condition);
        /* convert to condition */
        condValueRef = FunctionalFuncs.generateCondition(
            this.module,
            condValueRef,
            value.condition.type.kind,
        );
        const trueValueRef = this.wasmExprGen(value.trueExpr);
        const falseValueRef = this.wasmExprGen(value.falseExpr);
        assert(
            binaryen.getExpressionType(trueValueRef) ===
                binaryen.getExpressionType(falseValueRef),
            'trueWASMExprType and falseWASMExprType are not equal in conditional expression ',
        );
        return this.module.select(condValueRef, trueValueRef, falseValueRef);
    }

    private wasmInstanceOf(
        leftValue: SemanticsValue,
        rightValue: SemanticsValue,
    ) {
        const leftValueType = leftValue.type;
        const rightValueType = rightValue.type;
        if (!(rightValueType instanceof ObjectType)) {
            // Only support instanceof right-side is an ObjectType
            throw new Error('wasmInstanceOf: rightValue is not ObjectType');
        }
        if (!rightValueType.instanceType) {
            throw new Error(
                'wasmInstanceOf: rightValue does not have ObjectType',
            );
        }
        const rightValueInstType = (rightValueType as ObjectType).instanceType!;
        /** try to determine the result in compile time */
        if (leftValueType instanceof ObjectType) {
            let type: ObjectType | undefined = leftValueType;
            while (type) {
                if (type.equals(rightValueInstType)) {
                    return this.module.i32.const(1);
                }
                type = type.super;
            }
        }
        if (
            leftValueType instanceof ObjectType &&
            rightValueInstType instanceof ObjectType
        ) {
            let type: ObjectType | undefined = rightValueInstType;
            let isInInheritanceChain = false;
            while (type) {
                if (type.equals(leftValueType)) {
                    isInInheritanceChain = true;
                }
                type = type.super;
            }
            /* if left-side is object, if right-side is not interface, and not in inheritanceChain, return false */
            if (
                !isInInheritanceChain &&
                !leftValueType.meta.isInterface &&
                !rightValueType.meta.isInterface
            ) {
                return this.module.i32.const(0);
            }
        }

        /** try to determine the result in runtime */
        const leftValueRef = this.wasmExprGen(leftValue);
        /** create a default inst of  rightValueInstType */
        let rightWasmHeapType =
            this.wasmTypeGen.getWASMHeapType(rightValueInstType);
        if (
            rightValueInstType.meta.name.includes(
                BuiltinNames.OBJECTCONSTRUCTOR,
            )
        ) {
            rightWasmHeapType = emptyStructType.heapTypeRef;
        }
        if (
            rightValueInstType.meta.name.includes(
                BuiltinNames.FUNCTIONCONSTRCTOR,
            )
        ) {
            rightWasmHeapType = builtinClosureType.heapTypeRef;
        }
        const defaultRightValue = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([]).ptr,
            0,
            rightWasmHeapType,
        );
        const res = this.module.call(
            dyntype.dyntype_instanceof,
            [
                FunctionalFuncs.getDynContextRef(this.module),
                FunctionalFuncs.boxToAny(this.module, leftValueRef, leftValue),
                defaultRightValue,
            ],
            binaryen.i32,
        );
        return res;
    }

    private setThisRefToClosure(
        closureRef: binaryen.ExpressionRef,
        thisRef: binaryen.ExpressionRef,
    ) {
        return binaryenCAPI._BinaryenStructSet(
            this.module.ptr,
            1,
            closureRef,
            thisRef,
        );
    }

    private getFuncRefFromClosure(
        closureRef: binaryen.ExpressionRef,
        closureTypeRef: binaryen.Type,
    ) {
        const funcRef = binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            2,
            closureRef,
            closureTypeRef,
            false,
        );
        return funcRef;
    }

    private callClosureInternal(
        closureRef: binaryen.ExpressionRef,
        funcType: FunctionType,
        args?: SemanticsValue[],
        thisRef?: binaryen.ExpressionRef,
    ) {
        const closureVarTypeRef = binaryen.getExpressionType(closureRef);
        const closureTmpVar =
            this.wasmCompiler.currentFuncCtx!.insertTmpVar(closureVarTypeRef);
        const setClosureTmpVarRef = this.module.local.set(
            closureTmpVar.index,
            closureRef,
        );
        const getClosureTmpVarRef = this.module.local.get(
            closureTmpVar.index,
            closureVarTypeRef,
        );
        const _context = binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            0,
            getClosureTmpVarRef,
            closureVarTypeRef,
            false,
        );
        const _this = thisRef
            ? thisRef
            : binaryenCAPI._BinaryenStructGet(
                  this.module.ptr,
                  1,
                  getClosureTmpVarRef,
                  closureVarTypeRef,
                  false,
              );
        const funcRef = this.getFuncRefFromClosure(
            getClosureTmpVarRef,
            closureVarTypeRef,
        );
        this.wasmCompiler.currentFuncCtx!.insert(setClosureTmpVarRef);
        return this.callFuncRef(funcRef, funcType, args, _this, _context);
    }

    private callBuiltinOrStaticMethod(
        member: MemberDescription,
        target: string,
        args?: SemanticsValue[],
        isBuiltin = false,
    ) {
        let funcDecl = undefined;
        let methodName = `${target}|${member.name}`;
        if (member.isStaic) {
            methodName = `${target}|` + '@' + `${member.name}`;
            funcDecl = (<VarValue>member.methodOrAccessor!.method!)
                .ref as FunctionDeclareNode;
        }
        if (isBuiltin) {
            methodName = UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                methodName,
            );
        }
        const methodType = member.valueType as FunctionType;
        const returnTypeRef = this.wasmTypeGen.getWASMValueType(
            methodType.returnType,
        );
        return this.callFunc(
            methodType,
            methodName,
            returnTypeRef,
            args,
            funcDecl,
        );
    }

    private wasmOffsetCall(value: OffsetCallValue) {
        /* Array.xx, console.log */
        const ownerType = value.owner.type as ObjectType;
        const meta = ownerType.meta;
        let isBuiltIn: boolean;
        const memberIdx = value.index;
        const member = meta.members[memberIdx];
        let target = meta.name;

        if (BuiltinNames.builtInObjectTypes.includes(target)) {
            isBuiltIn = true;
        } else {
            isBuiltIn = false;
            if (member.isStaic) {
                /* Class static method */
                if (member.isOwn) {
                    target = (value.owner as VarValue).index as string;
                } else {
                    let baseMeta = meta.base;
                    while (baseMeta) {
                        const member = baseMeta.members[memberIdx];
                        if (member.isOwn) {
                            target = baseMeta.name.slice(1);
                            break;
                        }

                        baseMeta = baseMeta.base;
                    }
                    if (!baseMeta) {
                        throw new Error(
                            `Can not find static field ${member.name} in inherit chain of ${meta.name}}`,
                        );
                    }
                }
            } else {
                throw Error(
                    `offsetCall for ${target}|${member.name} is invalid`,
                );
            }
        }

        return this.callBuiltinOrStaticMethod(
            member,
            target,
            value.parameters,
            isBuiltIn,
        );
    }

    private wasmDirectCall(value: DirectCallValue) {
        const owner = value.owner as VarValue;
        const meta = owner.shape!.meta;
        const method = (value.method as VarValue).ref as FunctionDeclareNode;
        const returnTypeRef = this.wasmTypeGen.getWASMValueType(value.type);
        const member = meta.findMember(
            UtilFuncs.getLastElemOfBuiltinName(method.name),
        )!;
        const methodIdx = this.getTruthIdx(meta, member);
        let thisArg = this.wasmExprGen(owner);
        let ownerTypeRef = this.wasmTypeGen.getWASMValueType(owner.type);

        if ((owner.type as ObjectType).meta.isInterface) {
            /* workaround: need to get the actual typeRef based on owner.shape */
            ownerTypeRef = this.wasmTypeGen.objTypeMap.get(meta.name)!;
            thisArg = binaryenCAPI._BinaryenRefCast(
                this.module.ptr,
                thisArg,
                ownerTypeRef,
            );
        }

        if (owner.kind === SemanticsValueKind.SUPER) {
            return this.callFunc(
                method.funcType as FunctionType,
                method.name,
                returnTypeRef,
                value.parameters,
                method,
                undefined,
                thisArg,
            );
        } else {
            const methodRef = this.getObjMethod(
                thisArg,
                methodIdx,
                ownerTypeRef,
            );
            return this.callFuncRef(
                methodRef,
                method.funcType as FunctionType,
                value.parameters,
                thisArg,
                undefined,
                method,
            );
        }
    }

    private wasmFunctionCall(value: FunctionCallValue): binaryen.ExpressionRef {
        if (value.func instanceof FunctionCallValue) {
            /* Callee is returned from another function (closure) */
            const closureRef = this.wasmExprGen(value.func);
            const funcType = value.funcType as FunctionType;

            return this.callClosureInternal(
                closureRef,
                funcType,
                value.parameters,
            );
        }
        const funcType = value.funcType as FunctionType;
        const returnTypeRef = this.wasmTypeGen.getWASMValueType(
            funcType.returnType,
        );
        const funcValue = value.func;
        const args = value.parameters;
        if (funcValue instanceof VarValue) {
            /* In function call, ref only can be FunctionDeclareNode */
            const funcNode = funcValue.ref as FunctionDeclareNode;
            return this.callFunc(
                funcType,
                funcNode.name,
                returnTypeRef,
                args,
                funcNode,
            );
        } else {
            const closureRef = this.wasmExprGen(funcValue);
            return this.callClosureInternal(closureRef, funcType, args);
        }
    }

    private wasmEnumerateKeysGet(value: EnumerateKeysGetValue) {
        const targetObj = value.obj;
        const targetObjRef = this.wasmExprGen(targetObj);
        switch (targetObj.type.kind) {
            case ValueTypeKind.OBJECT:
            case ValueTypeKind.INTERFACE: {
                const wasmFuncName = getUtilsFuncName(
                    BuiltinNames.getPropNamesByMeta,
                );
                const returnTypeRef = this.wasmTypeGen.getWASMValueType(
                    value.type,
                );
                return this.module.call(
                    wasmFuncName,
                    [targetObjRef],
                    returnTypeRef,
                );
            }
            case ValueTypeKind.ANY: {
                return FunctionalFuncs.getObjKeys(this.module, targetObjRef);
            }
            default: {
                throw new UnimplementError(
                    `${targetObj.type.kind} kind is not supported yet`,
                );
            }
        }
    }

    private wasmClosureCall(value: ClosureCallValue): binaryen.ExpressionRef {
        const funcType = value.funcType as FunctionType;
        const closureRef = this.wasmExprGen(value.func as VarValue);
        return this.callClosureInternal(closureRef, funcType, value.parameters);
    }

    private callClassMethod(
        methodType: FunctionType,
        realReturnType: ValueType,
        calledName: string,
        thisRef: binaryen.ExpressionRef,
        valueType: ValueType,
        args?: SemanticsValue[],
    ): binaryen.ExpressionRef {
        if (BuiltinNames.genericBuiltinMethods.includes(calledName)) {
            if (valueType instanceof ArrayType) {
                const methodSuffix =
                    this.wasmTypeGen.getObjSpecialSuffix(valueType);
                calledName = calledName.concat(methodSuffix);
            } else {
                throw new Error(
                    'Generic builtin method only support array type',
                );
            }
        }

        const returnTypeRef = this.wasmTypeGen.getWASMValueType(
            methodType.returnType,
        );

        let res = this.callFunc(
            methodType,
            calledName,
            returnTypeRef,
            args,
            undefined,
            undefined,
            thisRef,
        );

        /* methodCallResultRef's type may not match the real return type
         * if real return type is not primitive type, we should do cast.
         */
        if (this.wasmTypeGen.hasHeapType(realReturnType)) {
            /* workaround: now binaryen_116version has bug:
             * it will generate ref.cast nullref when use callExpression to cast directly
             */
            const callResTypeRef = binaryen.anyref;
            const calledResVar =
                this.wasmCompiler.currentFuncCtx!.insertTmpVar(callResTypeRef);
            this.wasmCompiler.currentFuncCtx!.insert(
                this.module.local.set(calledResVar.index, res),
            );
            res = binaryenCAPI._BinaryenRefCast(
                this.module.ptr,
                this.module.local.get(calledResVar.index, callResTypeRef),
                this.wasmTypeGen.getWASMValueType(realReturnType),
            );
        }

        return res;
    }

    private callClassStaticMethod(
        ownValue: ObjectType,
        methodName: string,
        args?: SemanticsValue[],
    ) {
        const foundMember = this.getMemberByName(ownValue.meta, methodName);
        const methodMangledName = this.wasmCompiler.getMethodMangledName(
            foundMember,
            ownValue.meta,
        );
        // workaround: reason
        /* Currently, value.funcType is different with member type */
        const funcType = foundMember.valueType as FunctionType;
        /* get return type */
        const returnTypeRef = this.wasmTypeGen.getWASMValueType(
            funcType.returnType,
        );
        return this.callFunc(funcType, methodMangledName, returnTypeRef, args);
    }

    private wasmAnyCall(value: AnyCallValue) {
        /* call dynamic js function, which will callback to wasm finally */
        const anyFuncRef = this.wasmExprGen(value.anyFunc);
        const dynamicArg = this.generateDynamicArg(value.parameters);
        return this.module.call(
            dyntype.dyntype_invoke,
            [
                FunctionalFuncs.getDynContextRef(this.module),
                this.module.i32.const(0),
                anyFuncRef,
                dynamicArg,
            ],
            binaryen.anyref,
        );
    }

    private wasmVtableCall(value: VTableCallValue) {
        const owner = value.owner;
        const meta = owner.shape!.meta;
        const member = meta.members[value.index];
        const methodIdx = this.getTruthIdx(meta, member);
        const ownerRef = this.wasmExprGen(owner);
        const ownerTypeRef = this.wasmTypeGen.getWASMValueType(owner.type);
        switch (owner.type.kind) {
            case ValueTypeKind.OBJECT: {
                if (BuiltinNames.builtInObjectTypes.includes(meta.name)) {
                    const methodName = UtilFuncs.getBuiltinClassMethodName(
                        meta.name,
                        member.name,
                    );
                    const args: binaryen.ExpressionRef[] = [];
                    if (value.parameters) {
                        value.parameters.forEach((param) => {
                            const paramRef = this.wasmExprGen(param);
                            args.push(paramRef);
                        });
                    }
                    return this.callClassMethod(
                        value.funcType,
                        value.funcType.returnType,
                        methodName,
                        ownerRef,
                        owner.type,
                        value.parameters,
                    );
                } else {
                    const methodRef = this.getObjMethod(
                        ownerRef,
                        methodIdx,
                        ownerTypeRef,
                    );
                    return this.callFuncRef(
                        methodRef,
                        value.funcType,
                        value.parameters,
                        ownerRef,
                    );
                }
            }
            case ValueTypeKind.STRING: {
                if (getConfig().enableStringRef) {
                    /* fallback to libdyntype */
                    const nonFallbackMethods = [
                        'indexOf',
                        'split',
                        'match',
                        'search',
                    ];
                    if (!nonFallbackMethods.includes(member.name)) {
                        let invokeArgs = [
                            new CastValue(
                                SemanticsValueKind.VALUE_CAST_ANY,
                                owner.type,
                                owner,
                            ) as SemanticsValue,
                        ];
                        if (value.parameters) {
                            invokeArgs = invokeArgs.concat(value.parameters);
                        }

                        return this.module.call(
                            dyntype.dyntype_to_string,
                            [
                                FunctionalFuncs.getDynContextRef(this.module),
                                this.dyntypeInvoke(member.name, invokeArgs),
                            ],
                            binaryenCAPI._BinaryenTypeStringref(),
                        );
                    }
                }
                /* fallthrough */
            }
            default: {
                /* workaround: arr.push is vtableCall */
                const calledName = `${BuiltinNames.builtinModuleName}|${meta.name}|${member.name}`;
                /* workaround: method.valueType.returnType various from value.funcType.returnType */
                const realReturnType = value.funcType.returnType;
                return this.callClassMethod(
                    member.valueType as FunctionType,
                    realReturnType,
                    calledName,
                    ownerRef,
                    owner.type,
                    value.parameters,
                );
            }
        }
    }

    private wasmDynamicCall(value: DynamicCallValue): binaryen.ExpressionRef {
        const methodName = value.name;
        const owner = value.owner;
        switch (owner.type.kind) {
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY: {
                /* Fallback to libdyntype */
                let invokeArgs = [owner];
                if (value.parameters) {
                    invokeArgs = invokeArgs.concat(value.parameters);
                }
                return this.dyntypeInvoke(methodName, invokeArgs);
            }
            case ValueTypeKind.ARRAY:
            case ValueTypeKind.FUNCTION:
            case ValueTypeKind.BOOLEAN:
            case ValueTypeKind.NUMBER:
            case ValueTypeKind.STRING: {
                if (
                    getConfig().enableStringRef &&
                    owner.type.kind === ValueTypeKind.STRING
                ) {
                    let invokeArgs = [owner];
                    if (value.parameters) {
                        invokeArgs = invokeArgs.concat(value.parameters);
                    }
                    return this.dyntypeInvoke(methodName, invokeArgs);
                } else {
                    const className = 'String';
                    const builtInMeta = owner.shape!.meta!;
                    const foundMember = this.getMemberByName(
                        builtInMeta,
                        methodName,
                    );
                    const methodType = foundMember.valueType as FunctionType;
                    const thisRef = this.wasmExprGen(owner);
                    const calledName = `${BuiltinNames.builtinModuleName}|${className}|${methodName}`;
                    return this.callClassMethod(
                        methodType,
                        methodType.returnType,
                        calledName,
                        thisRef,
                        owner.type,
                        value.parameters,
                    );
                }
            }
            default:
                throw Error(`unimplement wasmDynamicCall in : ${value}`);
        }
    }

    private wasmShapeCall(value: ShapeCallValue): binaryen.ExpressionRef {
        /* When specialized (such as Array):
         * the original unspecialized type is stored in shape, and the specific specialized type is stored in type
         */
        const owner = value.owner as VarValue;
        const shapeMeta = owner.shape!.meta!;
        const shapeMember = shapeMeta.members[value.index];
        const args = value.parameters;
        let target = shapeMeta.name;

        /* Workaround: should use meta.isBuiltin, but currently only class defined
            inside src/semantics/builtin.ts will be marked as builtin. After that
            issue fixed, we should modify the code here */
        if (
            BuiltinNames.builtInObjectTypes.some((elem) => {
                if (target.includes(elem)) {
                    target = elem;
                    return true;
                } else {
                    return false;
                }
            })
        ) {
            return this.callBuiltinOrStaticMethod(
                shapeMember,
                target,
                value.parameters,
                true,
            );
        }

        switch (owner.type.kind) {
            case ValueTypeKind.OBJECT: {
                if (owner.ref instanceof ObjectType) {
                    return this.callClassStaticMethod(
                        owner.ref,
                        shapeMember.name,
                        value.parameters,
                    );
                } else {
                    const ownerType = owner.type as ObjectType;
                    const typeMeta = ownerType.meta;
                    const typeMember = typeMeta.findMember(
                        shapeMember.name,
                    ) as MemberDescription;
                    const thisRef = this.wasmExprGen(owner);
                    return this.getInstProperty(
                        thisRef,
                        ownerType,
                        typeMeta,
                        typeMember,
                        true,
                        args,
                    );
                }
            }
            case ValueTypeKind.ARRAY: {
                // workaround:
                /* Array type can be specialized, so we should get the type meta */
                const typeMeta = (owner.type as ArrayType).meta;
                const member = typeMeta.members[value.index];
                const thisRef = this.wasmExprGen(owner);
                /* array builtin method call */
                let methodName = member.name;
                for (const builtinMethod of BuiltinNames.genericBuiltinMethods) {
                    if (builtinMethod.includes(member.name)) {
                        methodName = builtinMethod;
                        break;
                    }
                }
                const methodSuffix = this.wasmTypeGen.getObjSpecialSuffix(
                    owner.type as ArrayType,
                );
                methodName = methodName.concat(methodSuffix);
                const memberFuncType = member.valueType as FunctionType;
                const returnTypeRef = this.wasmTypeGen.getWASMValueType(
                    memberFuncType.returnType,
                );
                const methodCallResultRef = this.callFunc(
                    memberFuncType,
                    methodName,
                    returnTypeRef,
                    args,
                    undefined,
                    undefined,
                    thisRef,
                );
                /* methodCallResultRef's type may not match the real return type
                 * if real return type is not primitive type, we should do cast.
                 */
                let res = methodCallResultRef;
                if (this.wasmTypeGen.hasHeapType(memberFuncType.returnType)) {
                    res = binaryenCAPI._BinaryenRefCast(
                        this.module.ptr,
                        methodCallResultRef,
                        returnTypeRef,
                    );
                }
                return res;
            }
            default: {
                throw Error(`TODO: ${value.type.kind}`);
            }
        }
    }

    private wasmAnyCast(value: CastValue): binaryen.ExpressionRef {
        const fromValue = value.value;
        const fromType = fromValue.type;
        const toType = value.type;
        switch (value.kind) {
            case SemanticsValueKind.ANY_CAST_VALUE:
            case SemanticsValueKind.UNION_CAST_VALUE: {
                const fromValueRef = this.wasmExprGen(fromValue);
                return FunctionalFuncs.unboxAnyToBase(
                    this.module,
                    fromValueRef,
                    toType.kind,
                );
            }
            case SemanticsValueKind.VALUE_CAST_ANY:
            case SemanticsValueKind.UNION_CAST_ANY:
            case SemanticsValueKind.VALUE_CAST_UNION: {
                const fromValueRef = this.wasmExprGen(fromValue);
                return FunctionalFuncs.boxToAny(
                    this.module,
                    fromValueRef,
                    fromValue,
                );
            }
            case SemanticsValueKind.OBJECT_CAST_ANY: {
                return this.wasmObjTypeCastToAny(value);
            }
            case SemanticsValueKind.ANY_CAST_OBJECT:
            case SemanticsValueKind.UNION_CAST_OBJECT: {
                const fromValueRef = this.wasmExprGen(fromValue);
                const toTypeRef = this.wasmTypeGen.getWASMValueType(toType);
                return FunctionalFuncs.unboxAnyToExtref(
                    this.module,
                    fromValueRef,
                    toTypeRef,
                );
            }
            case SemanticsValueKind.OBJECT_CAST_VALUE: {
                if (toType.kind === ValueTypeKind.NULL) {
                    /* Sometimes the function may be inferred to return a null, e.g.:
                        function foo() {
                            const a: A | null = null;
                            return a;
                        }
                    */
                    return this.module.ref.null(
                        this.wasmTypeGen.getWASMType(fromType),
                    );
                } else {
                    throw new UnimplementError(
                        `OBJECT_CAST_VALUE from ${fromType} to ${toType}`,
                    );
                }
            }
            case SemanticsValueKind.OBJECT_CAST_UNION: {
                if (fromValue instanceof NewLiteralArrayValue) {
                    // box the literal array to any
                    return this.wasmObjTypeCastToAny(value);
                } else {
                    const fromValueRef = this.wasmExprGen(fromValue);
                    return FunctionalFuncs.boxToAny(
                        this.module,
                        fromValueRef,
                        fromValue,
                    );
                }
            }
            default:
                throw new UnimplementError(`wasmCastValue: ${value}`);
        }
    }

    private wasmValueCast(value: CastValue) {
        const fromType = value.value.type;
        const fromValueRef = this.wasmExprGen(value.value);
        const fromTypeRef = this.wasmTypeGen.getWASMType(fromType);
        const toType = value.type;
        /* if toType is BOOLEAN, then need to generate condition */
        if (toType.kind === ValueTypeKind.BOOLEAN) {
            return FunctionalFuncs.generateCondition(
                this.module,
                fromValueRef,
                fromType.kind,
            );
        }
        /* do type cast */
        if (fromType.kind === ValueTypeKind.INT) {
            if (toType.kind === ValueTypeKind.NUMBER) {
                return FunctionalFuncs.convertTypeToF64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_I64) {
                return FunctionalFuncs.convertTypeToI64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_F32) {
                return FunctionalFuncs.convertTypeToF32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        } else if (fromType.kind === ValueTypeKind.NUMBER) {
            if (toType.kind === ValueTypeKind.INT) {
                return FunctionalFuncs.convertTypeToI32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_I64) {
                return FunctionalFuncs.convertTypeToI64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_F32) {
                return FunctionalFuncs.convertTypeToF32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        } else if (fromType.kind === ValueTypeKind.WASM_I64) {
            if (toType.kind === ValueTypeKind.INT) {
                return FunctionalFuncs.convertTypeToI32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.NUMBER) {
                return FunctionalFuncs.convertTypeToF64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_F32) {
                return FunctionalFuncs.convertTypeToF32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        } else if (fromType.kind === ValueTypeKind.WASM_F32) {
            if (toType.kind === ValueTypeKind.INT) {
                return FunctionalFuncs.convertTypeToI32(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.NUMBER) {
                return FunctionalFuncs.convertTypeToF64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            } else if (toType.kind === ValueTypeKind.WASM_I64) {
                return FunctionalFuncs.convertTypeToI64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        } else if (fromType.kind === ValueTypeKind.BOOLEAN) {
            if (toType.kind === ValueTypeKind.NUMBER) {
                return FunctionalFuncs.convertTypeToF64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        } else if (fromType.kind === ValueTypeKind.ENUM) {
            if (toType.kind === ValueTypeKind.NUMBER) {
                return FunctionalFuncs.convertTypeToF64(
                    this.module,
                    fromValueRef,
                    fromTypeRef,
                );
            }
        }
        throw new UnimplementError(`wasmValueCast: ${value}`);
    }

    private parseArguments(
        funcType: FunctionType,
        envArgs: binaryen.ExpressionRef[],
        args?: SemanticsValue[],
        funcNode?: FunctionDeclareNode,
    ) {
        const envArgLen = envArgs.length;
        const paramTypes = funcType.argumentsType;
        const callerArgs: binaryen.ExpressionRef[] = new Array(
            paramTypes.length + envArgLen,
        );
        /* parse @context and @this */
        for (let i = 0; i < envArgLen; i++) {
            callerArgs[i] = envArgs[i];
        }

        /* parse optional param as undefined */
        for (let i = 0; i < paramTypes.length; i++) {
            /* workaround: when promise generic type is void, function call arguments may be empty.
            We should add undefined as argument here.
            new Promise<void>((resolve, reject) => {
                resolve();
            });
            */
            if (
                funcType.isOptionalParams[i] ||
                funcType.argumentsType[i].kind === ValueTypeKind.TYPE_PARAMETER
            ) {
                callerArgs[i + envArgLen] =
                    FunctionalFuncs.generateDynUndefined(this.module);
            }
        }

        /* parse default params */
        if (funcNode && funcNode.parameters) {
            for (let i = 0; i < funcNode.parameters.length; i++) {
                const defaultParam = funcNode.parameters[i];
                if (defaultParam.initValue) {
                    const initValue = defaultParam.initValue;
                    let defaultArg = this.wasmExprGen(defaultParam.initValue);
                    if (
                        defaultParam.type.kind === ValueTypeKind.ANY &&
                        initValue.type.kind !== ValueTypeKind.ANY
                    ) {
                        /* Workaround: for default parameters (e.g. b: any = 8), the type of
                            the initValue is treated as a number and not casted to any, which
                            will make the generated wasm module contained mismatched types */
                        defaultArg = FunctionalFuncs.boxToAny(
                            this.module,
                            defaultArg,
                            initValue,
                        );
                    }

                    callerArgs[i + envArgLen] = defaultArg;
                }
            }
        }

        if (!args) {
            if (funcType.restParamIdx !== -1) {
                const restType = paramTypes[funcType.restParamIdx] as ArrayType;
                callerArgs[funcType.restParamIdx + envArgLen] = this.initArray(
                    restType,
                    [],
                );
            }
            return callerArgs;
        }

        /* parse regular args, real args don't contain @context and @this */
        for (let i = 0; i < args.length; i++) {
            if (funcType.restParamIdx === i) {
                break;
            }
            callerArgs[i + envArgLen] = this.wasmExprGen(args[i]);
        }

        /* parse rest params */
        if (funcType.restParamIdx !== -1) {
            const restType = paramTypes[funcType.restParamIdx];
            if (restType instanceof ArrayType) {
                if (args.length > funcType.restParamIdx) {
                    callerArgs[funcType.restParamIdx + envArgLen] =
                        this.initArray(
                            restType,
                            args.slice(funcType.restParamIdx),
                        );
                } else {
                    callerArgs[funcType.restParamIdx + envArgLen] =
                        this.initArray(restType, []);
                }
            } else {
                Logger.error(`rest type is not array`);
            }
        }
        return callerArgs;
    }

    private initArray(arrType: ArrayType, elements: SemanticsValue[]) {
        return this.wasmElemsToArr(elements, arrType);
    }

    /* Currently we don't believe the index provided by semantic tree, semantic
        tree treat all method/accessors as instance field, but in binaryen
        backend we put all these into vtable, so every getter/setter pair will
        occupies two vtable slots */
    private fixVtableIndex(
        meta: ObjectDescription,
        member: MemberDescription,
        isSetter = false,
    ) {
        const members = meta.members;
        const bound = members.findIndex((m) => m.name === member.name);
        let index = bound;
        if (index < 0) {
            throw new Error(
                `get field index failed, field name is ${member.name}`,
            );
        }
        for (let i = 0; i < bound; i++) {
            if (members[i].type === MemberType.FIELD) {
                index--;
            }
            /** it occupies two slots */
            if (members[i].hasGetter && members[i].hasSetter) {
                index++;
            }
        }

        if (isSetter && member.hasGetter) {
            index++;
        }

        return index;
    }

    private fixFieldIndex(
        meta: ObjectDescription,
        member: MemberDescription,
        isStatic = false,
    ) {
        const members = meta.members;
        const bound = members.findIndex((m) => m.name === member.name);
        let index = 0;

        for (let i = 0; i < bound; i++) {
            if (members[i].type === MemberType.FIELD) {
                if (isStatic) {
                    if (members[i].isStaic) {
                        index++;
                    }
                } else {
                    if (!members[i].isStaic) {
                        index++;
                    }
                }
            }
        }
        return index;
    }

    private setObjField(
        objRef: binaryen.ExpressionRef,
        fieldIdx: number,
        targetValueRef: binaryen.ExpressionRef,
    ) {
        return binaryenCAPI._BinaryenStructSet(
            this.module.ptr,
            fieldIdx + 1,
            objRef,
            targetValueRef,
        );
    }

    private setObjMethod(
        objRef: binaryen.ExpressionRef,
        methodIdx: number,
        objTypeRef: binaryen.Type,
        targetValueRef: binaryen.ExpressionRef,
    ) {
        const vtableRef = binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            0,
            objRef,
            objTypeRef,
            false,
        );
        return binaryenCAPI._BinaryenStructSet(
            this.module.ptr,
            /** because the first index is point to meta, so methodIdx should plus 1 */
            methodIdx + 1,
            vtableRef,
            targetValueRef,
        );
    }

    private getBuiltinObjField(
        objRef: binaryen.ExpressionRef,
        fieldIdx: number,
        objTypeRef: binaryen.Type,
    ) {
        return binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            fieldIdx,
            objRef,
            objTypeRef,
            false,
        );
    }

    private getObjField(
        objRef: binaryen.ExpressionRef,
        fieldIdx: number,
        objTypeRef: binaryen.Type,
    ) {
        return binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            fieldIdx + 1,
            objRef,
            objTypeRef,
            false,
        );
    }

    private getObjMethod(
        objRef: binaryen.ExpressionRef,
        methodIdx: number,
        objTypeRef: binaryen.Type,
    ) {
        const vtableRef = binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            0,
            objRef,
            objTypeRef,
            false,
        );
        return binaryenCAPI._BinaryenStructGet(
            this.module.ptr,
            /** because the first index is point to meta, so methodIdx should plus 1 */
            methodIdx + 1,
            vtableRef,
            binaryen.getExpressionType(vtableRef),
            false,
        );
    }

    private getObjMethodAsClosure(
        objRef: binaryen.ExpressionRef,
        methodIdx: number,
        objTypeRef: binaryen.Type,
        methodType: FunctionType,
    ) {
        const methodRef = this.getObjMethod(objRef, methodIdx, objTypeRef);
        return this.getClosureOfFunc(methodRef, methodType, objRef);
    }

    private callFuncRef(
        targetFunction: binaryen.ExpressionRef,
        funcType: FunctionType,
        args?: SemanticsValue[],
        _this?: binaryen.ExpressionRef,
        _context?: binaryen.ExpressionRef,
        funcDecl?: FunctionDeclareNode,
    ) {
        const returnTypeRef = this.wasmTypeGen.getWASMValueType(
            funcType.returnType,
        );
        if (!_context) {
            _context = this.wasmCompiler.emptyRef;
        }
        if (!_this) {
            _this = this.wasmCompiler.emptyRef;
        }
        const envArgs: binaryen.ExpressionRef[] = [_context, _this];
        const callArgsRefs = this.parseArguments(
            funcType,
            envArgs,
            args,
            funcDecl,
        );

        return binaryenCAPI._BinaryenCallRef(
            this.module.ptr,
            targetFunction,
            arrayToPtr(callArgsRefs).ptr,
            callArgsRefs.length,
            returnTypeRef,
            false,
        );
    }

    private callFunc(
        funcType: FunctionType,
        funcName: string,
        returnType: binaryen.Type,
        args?: SemanticsValue[],
        funcDecl?: FunctionDeclareNode,
        context?: binaryen.ExpressionRef,
        thisArg?: binaryen.ExpressionRef,
    ) {
        if (!context) {
            context = this.wasmCompiler.emptyRef;
        }
        if (!thisArg) {
            thisArg = this.wasmCompiler.emptyRef;
        }
        const envArgs: binaryen.ExpressionRef[] = [context, thisArg];
        const callArgsRefs = this.parseArguments(
            funcType,
            envArgs,
            args,
            funcDecl,
        );
        return this.module.call(funcName, callArgsRefs, returnType);
    }

    private wasmObjFieldSet(
        value: ShapeSetValue | OffsetSetValue | VTableSetValue,
        rightValue?: SemanticsValue,
    ) {
        const owner = value.owner as VarValue;
        const shapeMeta = owner.shape!.meta;
        const shapeMember = shapeMeta.members[value.index];
        const ownerType = owner.type as ObjectType;
        let targetValue = value.value!;
        if (rightValue) {
            targetValue = rightValue;
        }
        const typeMeta = ownerType.meta;
        const typeMember = typeMeta.findMember(
            shapeMember.name,
        ) as MemberDescription;
        return this.setInstProperty(
            this.wasmExprGen(owner),
            ownerType,
            typeMeta,
            typeMember,
            targetValue,
        );
    }

    private setInstProperty(
        thisRef: binaryen.ExpressionRef,
        ownerType: ObjectType,
        typeMeta: ObjectDescription,
        typeMember: MemberDescription,
        targetValue: SemanticsValue,
    ) {
        const isSetter = typeMember.hasSetter ? true : false;
        if (isSetter) {
            return this.getInstProperty(
                thisRef,
                ownerType,
                typeMeta,
                typeMember,
                isSetter,
                [targetValue],
                isSetter,
            );
        } else {
            const propertyIdx = this.getTruthIdx(
                typeMeta,
                typeMember,
                typeMember.hasSetter,
            );
            if (typeMeta.isInterface) {
                return this.setInfcProperty(
                    typeMember,
                    ownerType,
                    thisRef,
                    propertyIdx,
                    targetValue,
                );
            } else {
                return this.setObjProperty(
                    typeMember,
                    ownerType,
                    thisRef,
                    propertyIdx,
                    targetValue,
                );
            }
        }
    }

    private setInfcProperty(
        member: MemberDescription,
        infcType: ValueType,
        thisRef: binaryen.ExpressionRef,
        propertyIdx: number,
        targetValue: SemanticsValue,
    ) {
        const metaRef = FunctionalFuncs.getWASMObjectMeta(this.module, thisRef);
        const memberNameRef = this.getStringOffset(member.name);
        let flag = ItableFlag.ALL;
        if (member.hasSetter) {
            flag = ItableFlag.SETTER;
        }
        const flagAndIndexRef = this.getPropFlagAndIdxRefFromObj(
            metaRef,
            memberNameRef,
            flag,
        );
        const propTypeIdRef = this.getPropTypeIdRefFromObj(
            metaRef,
            memberNameRef,
            flag,
        );
        const propType = member.hasSetter
            ? (member.setter as VarValue).type
            : member.valueType;
        const targetValueRef = this.wasmExprGen(targetValue);

        /* TODO: workaround: quick path may fail, since cast failure */
        const infcDescTypeRef = this.wasmTypeGen.getWASMObjOriType(infcType);
        const castedObjRef = binaryenCAPI._BinaryenRefCast(
            this.module.ptr,
            thisRef,
            infcDescTypeRef,
        );
        const ifShapeCompatibal = FunctionalFuncs.isShapeCompatible(
            this.module,
            infcType.typeId,
            metaRef,
        );
        let ifCompatibalTrue: binaryen.ExpressionRef;
        if (targetValue.type.kind === ValueTypeKind.FUNCTION) {
            /* if property's value type is function, and typeid is equal, then we can set property to vtable */
            ifCompatibalTrue = this.setObjMethod(
                castedObjRef,
                propertyIdx,
                infcDescTypeRef,
                this.getFuncRefFromClosure(
                    targetValueRef,
                    this.wasmTypeGen.getWASMValueType(targetValue.type),
                ),
            );
        } else {
            /* if property's value type is not function, then it must be a field */
            ifCompatibalTrue = this.setObjField(
                castedObjRef,
                propertyIdx,
                targetValueRef,
            );
        }
        const ifCompatibalFalse = this.dynSetInfcProperty(
            thisRef,
            flagAndIndexRef,
            targetValue.type,
            member.isOptional,
            propTypeIdRef,
            targetValueRef,
        );
        /* set property from interface */
        return this.module.if(
            ifShapeCompatibal,
            ifCompatibalTrue,
            ifCompatibalFalse,
        );
    }

    private setObjProperty(
        member: MemberDescription,
        objType: ValueType,
        thisRef: binaryen.ExpressionRef,
        propertyIdx: number,
        targetValue: SemanticsValue,
    ) {
        const thisTypeRef = this.wasmTypeGen.getWASMType(objType);
        const targetValueRef = this.wasmExprGen(targetValue);
        let res: binaryen.ExpressionRef;

        if (member.type === MemberType.FIELD) {
            res = this.setObjField(thisRef, propertyIdx, targetValueRef);
        } else {
            res = this.setObjMethod(
                thisRef,
                propertyIdx,
                thisTypeRef,
                targetValueRef,
            );
        }
        return res;
    }

    private getInstProperty(
        thisRef: binaryen.ExpressionRef,
        ownerType: ObjectType,
        typeMeta: ObjectDescription,
        typeMember: MemberDescription,
        isCall = false,
        args?: SemanticsValue[],
        isSetter = false,
    ) {
        const propertyIdx = this.getTruthIdx(typeMeta, typeMember, isSetter);
        if (typeMeta.isInterface) {
            return this.getInfcProperty(
                typeMember,
                ownerType,
                thisRef,
                propertyIdx,
                isCall,
                args,
                isSetter,
            );
        } else {
            return this.getObjProperty(
                typeMember,
                ownerType,
                thisRef,
                propertyIdx,
                isCall,
                args,
                isSetter,
            );
        }
    }

    private getInfcProperty(
        member: MemberDescription,
        infcType: ValueType,
        thisRef: binaryen.ExpressionRef,
        propertyIdx: number,
        isCall = false,
        args?: SemanticsValue[],
        isSetter = false,
    ) {
        const metaRef = FunctionalFuncs.getWASMObjectMeta(this.module, thisRef);
        const memberNameRef = this.getStringOffset(member.name);
        const flag = ItableFlag.ALL;
        const flagAndIndexRef = this.getPropFlagAndIdxRefFromObj(
            metaRef,
            memberNameRef,
            flag,
        );
        const propTypeIdRef = this.getPropTypeIdRefFromObj(
            metaRef,
            memberNameRef,
            flag,
        );
        const propType = isSetter
            ? (member.setter as VarValue).type
            : member.hasGetter
            ? (member.getter as VarValue).type
            : member.valueType;

        /* TODO: workaround: quick path may fail, since cast failure */
        const infcDescTypeRef = this.wasmTypeGen.getWASMObjOriType(infcType);
        const castedObjRef = binaryenCAPI._BinaryenRefCast(
            this.module.ptr,
            thisRef,
            infcDescTypeRef,
        );
        const ifShapeCompatibal = FunctionalFuncs.isShapeCompatible(
            this.module,
            infcType.typeId,
            metaRef,
        );
        let ifCompatibalTrue: binaryen.ExpressionRef;
        if (propType.kind === ValueTypeKind.FUNCTION) {
            /* if property's value type is function, and typeid is equal, then we can get property from vtable */
            /* methodRef get from vtable is a funcref, we need to box it to closure */
            ifCompatibalTrue = this.getObjMethodAsClosure(
                castedObjRef,
                propertyIdx,
                infcDescTypeRef,
                propType as FunctionType,
            );
        } else {
            /* if property's value type is not function, then it must be a field */
            ifCompatibalTrue = this.getObjField(
                castedObjRef,
                propertyIdx,
                infcDescTypeRef,
            );
        }
        const ifCompatibalFalse = this.dynGetInfcProperty(
            thisRef,
            flagAndIndexRef,
            propType,
            member.isOptional,
            propTypeIdRef,
        );
        /* get property from interface */
        let res = this.module.if(
            ifShapeCompatibal,
            ifCompatibalTrue,
            ifCompatibalFalse,
        );

        /* If isCall or member is an accessor, call the memberRef, and get the result */
        if (
            member.type === MemberType.ACCESSOR ||
            (propType.kind === ValueTypeKind.FUNCTION && isCall)
        ) {
            /* the function we get must be a closure, we need to callClosureInternal */
            if (member.isOptional) {
                /* if member is optional, need to do unbox */
                res = FunctionalFuncs.unboxAnyToExtref(
                    this.module,
                    res,
                    this.wasmTypeGen.getWASMValueType(propType as FunctionType),
                );
            }
            res = this.callClosureInternal(
                res,
                propType as FunctionType,
                args,
                thisRef,
            );
        }
        return res;
    }

    private getObjProperty(
        member: MemberDescription,
        objType: ValueType,
        thisRef: binaryen.ExpressionRef,
        memberIdx: number,
        isCall = false,
        args?: SemanticsValue[],
        isSetter = false,
    ) {
        const thisTypeRef = this.wasmTypeGen.getWASMType(objType);
        const propType = isSetter
            ? (member.setter as VarValue).type
            : member.hasGetter
            ? (member.getter as VarValue).type
            : member.valueType;
        let res: binaryen.ExpressionRef;

        if (member.type === MemberType.FIELD) {
            const fieldValueRef = this.getObjField(
                thisRef,
                memberIdx,
                thisTypeRef,
            );
            if (propType.kind === ValueTypeKind.FUNCTION) {
                /* If propType is FunctionType, then we must reset @this value in closure */
                const fieldTmpVar =
                    this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                        this.wasmTypeGen.getWASMValueType(propType),
                    );
                const setValueRef = this.module.local.set(
                    fieldTmpVar.index,
                    fieldValueRef,
                );
                this.wasmCompiler.currentFuncCtx!.insert(setValueRef);
                const getValueRef = this.module.local.get(
                    fieldTmpVar.index,
                    fieldTmpVar.type,
                );
                this.wasmCompiler.currentFuncCtx!.insert(
                    this.setThisRefToClosure(getValueRef, thisRef),
                );
                res = getValueRef;
                if (isCall) {
                    /* If is called, then call the field closure */
                    res = this.callClosureInternal(
                        res,
                        propType as FunctionType,
                        args,
                    );
                }
            } else {
                res = fieldValueRef;
            }
        } else {
            if (
                member.type === MemberType.ACCESSOR ||
                (member.type === MemberType.METHOD && isCall)
            ) {
                res = this.getObjMethod(thisRef, memberIdx, thisTypeRef);
                res = this.callFuncRef(
                    res,
                    propType as FunctionType,
                    args,
                    thisRef,
                );
            } else {
                res = this.getObjMethodAsClosure(
                    thisRef,
                    memberIdx,
                    thisTypeRef,
                    propType as FunctionType,
                );
            }
        }
        return res;
    }

    private getPropFlagAndIdxRefFromObj(
        meta: binaryen.ExpressionRef,
        name: binaryen.ExpressionRef,
        flag: ItableFlag,
    ) {
        return this.module.call(
            BuiltinNames.findPropertyFlagAndIndex,
            [meta, name, this.module.i32.const(flag)],
            binaryen.i32,
        );
    }

    private getPropTypeIdRefFromObj(
        meta: binaryen.ExpressionRef,
        name: binaryen.ExpressionRef,
        flag: ItableFlag,
    ) {
        return this.module.call(
            BuiltinNames.findPropertyType,
            [meta, name, this.module.i32.const(flag)],
            binaryen.i32,
        );
    }

    /** return method in the form of closure */
    private getClosureOfFunc(
        func: binaryen.ExpressionRef,
        type: FunctionType,
        _this: binaryen.ExpressionRef,
    ) {
        const closureType = this.wasmTypeGen.getWASMValueHeapType(type);
        const res = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([this.wasmCompiler.emptyRef, _this, func]).ptr,
            3,
            closureType,
        );
        return res;
    }

    private wasmNewLiteralObj(value: NewLiteralObjectValue) {
        const objHeapTypeRef = this.wasmTypeGen.getWASMHeapType(value.type);
        const vtableHeapTypeRef = this.wasmTypeGen.getWASMVtableHeapType(
            value.type,
        );
        const members = (value.type as ObjectType).meta.members;
        const propRefList: binaryen.ExpressionRef[] = [];
        const vtable: binaryen.ExpressionRef[] = [];
        for (let i = 0; i < members.length; i++) {
            /* eg.  arr = [{a:1}, {a:2}, {a:3, b:4}]
            TSC treate arr type is Array<{a:number, b?: number} | {a:number, b:number}>
            */
            if (!value.initValues[i]) {
                propRefList.push(
                    FunctionalFuncs.generateDynUndefined(this.module),
                );
            } else {
                const memberValueRef = this.wasmExprGen(value.initValues[i]);
                if (members[i].type === MemberType.FIELD) {
                    propRefList.push(memberValueRef);
                } else if (members[i].type === MemberType.METHOD) {
                    vtable.push(memberValueRef);
                }
            }
        }
        const vtableRef = this.wasmTypeGen.getWASMVtableInst(value.type);
        propRefList.unshift(vtableRef);
        const objectLiteralValueRef = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr(propRefList).ptr,
            propRefList.length,
            objHeapTypeRef,
        );
        return objectLiteralValueRef;
    }

    private wasmObjCast(value: CastValue) {
        const oriValueRef = this.wasmExprGen(value.value);
        const oriValueType = value.value.type as ObjectType;
        const toValueType = value.type as ObjectType;
        if (toValueType.flags === ObjectTypeFlag.UNION) {
            return this.wasmObjTypeCastToAny(value);
        }
        if (oriValueType instanceof UnionType) {
            const toTypeRef = this.wasmTypeGen.getWASMValueType(toValueType);
            return FunctionalFuncs.unboxAnyToExtref(
                this.module,
                oriValueRef,
                toTypeRef,
            );
        }
        switch (oriValueType.meta.type) {
            case ObjectDescriptionType.OBJECT_INSTANCE:
            case ObjectDescriptionType.OBJECT_CLASS:
            case ObjectDescriptionType.OBJECT_LITERAL: {
                if (toValueType.meta.isInterface) {
                    return oriValueRef;
                }
                /** check if it is upcasting  */
                let fromType: ObjectType | undefined = oriValueType;
                while (fromType) {
                    if (fromType.equals(toValueType)) {
                        return oriValueRef;
                    }
                    fromType = fromType.super;
                }

                const toValueWasmType =
                    this.wasmTypeGen.getWASMType(toValueType);
                return binaryenCAPI._BinaryenRefCast(
                    this.module.ptr,
                    oriValueRef,
                    toValueWasmType,
                );
            }
            case ObjectDescriptionType.INTERFACE: {
                if (toValueType.meta.isInterface) {
                    /* interfaceObj to interfaceObj */
                    return oriValueRef;
                } else {
                    /** need to check the cast can be successful */
                    return this.infcCastToObj(oriValueRef, toValueType);
                }
            }
        }
    }

    private infcCastToObj(ref: binaryen.ExpressionRef, toType: ObjectType) {
        const meta = FunctionalFuncs.getWASMObjectMeta(this.module, ref);
        const typeIdRef = FunctionalFuncs.getFieldFromMetaByOffset(
            this.module,
            meta,
            MetaDataOffset.TYPE_ID_OFFSET,
        );
        const canbeCasted = this.module.i32.eq(
            typeIdRef,
            this.module.i32.const(toType.typeId),
        );
        return this.module.if(
            canbeCasted,
            binaryenCAPI._BinaryenRefCast(
                this.module.ptr,
                ref,
                this.wasmTypeGen.getWASMType(toType),
            ),
            this.module.unreachable(),
        );
    }

    private wasmNewClass(value: NewConstructorObjectValue) {
        const objectTypeRef = this.wasmTypeGen.getWASMType(value.type);

        /* currently, ctor is only in a seperate field, not be put into members */
        const metaInfo = (value.type as ObjectType).meta;
        if (!metaInfo.ctor) {
            const className = metaInfo.name;
            if (BuiltinNames.fallbackConstructors.includes(metaInfo.name)) {
                /* workaround: Error constructor is not defined, so we can fallback temporarily */
                /* Fallback to libdyntype */
                return this.dyntypeInvoke(className, value.parameters, true);
            } else {
                const ctorName = UtilFuncs.getBuiltinClassCtorName(className);
                const ctorInfcDefination = GetBuiltinObjectType(
                    className.concat(BuiltinNames.ctorName),
                );
                const ctorMember = ctorInfcDefination.meta.findConstructor();
                if (!ctorMember) {
                    throw Error(`can not find ctor type in ${className}`);
                }
                return this.callFunc(
                    ctorMember.valueType as FunctionType,
                    ctorName,
                    objectTypeRef,
                    value.parameters,
                );
            }
        } else {
            const ctorFuncDecl = (
                metaInfo.ctor!.methodOrAccessor!.method! as VarValue
            ).ref as FunctionDeclareNode;
            const thisArg = this.wasmTypeGen.getWASMThisInst(value.type);

            return this.callFunc(
                metaInfo.ctor!.valueType as FunctionType,
                ctorFuncDecl.name,
                objectTypeRef,
                value.parameters,
                ctorFuncDecl,
                undefined,
                thisArg,
            );
        }
    }

    private getClassStaticField(
        member: MemberDescription,
        meta: ObjectDescription,
        objType: ObjectType,
    ) {
        /* class A; A.yy */
        if (member.type === MemberType.FIELD && member.isStaic) {
            const valueIdx = this.fixFieldIndex(meta, member, true);
            const staticFieldsTypeRef =
                this.wasmTypeGen.getWASMStaticFieldsType(objType);
            const name = meta.name + '|static_fields';
            const staticFields = binaryenCAPI._BinaryenGlobalGet(
                this.module.ptr,
                UtilFuncs.getCString(name),
                staticFieldsTypeRef,
            );
            return binaryenCAPI._BinaryenStructGet(
                this.module.ptr,
                valueIdx,
                staticFields,
                staticFieldsTypeRef,
                false,
            );
        } else {
            throw Error(`${member} is not a static field`);
        }
    }

    private wasmObjFieldGet(
        value: DirectGetValue | ShapeGetValue | OffsetGetValue | VTableGetValue,
    ) {
        /* Workaround: ShapeGetValue's field index now based on its origin shape, not objectType */
        const owner = value.owner;
        const shapeMeta = owner.shape!.meta;
        const shapeMember = shapeMeta.members[value.index];
        switch (owner.type.kind) {
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY: {
                /* let o: A|null = new A; o'field type is real type, not any type */
                const objRef = this.wasmExprGen(owner);
                const propNameRef = this.getStringOffset(shapeMember.name);
                const memberType = shapeMember.valueType;
                const anyObjProp = FunctionalFuncs.getDynObjProp(
                    this.module,
                    objRef,
                    propNameRef,
                );
                return FunctionalFuncs.unboxAny(
                    this.module,
                    anyObjProp,
                    memberType.kind,
                    this.wasmTypeGen.getWASMType(memberType),
                );
            }
            case ValueTypeKind.OBJECT: {
                const ownerType = owner.type as ObjectType;
                const typeMeta = ownerType.meta;
                const typeMember = typeMeta.findMember(
                    shapeMember.name,
                ) as MemberDescription;
                if (
                    owner instanceof VarValue &&
                    owner.ref instanceof ObjectType
                ) {
                    /* static field get */
                    return this.getClassStaticField(
                        typeMember,
                        typeMeta,
                        ownerType,
                    );
                } else {
                    const objRef = this.wasmExprGen(owner);
                    if (
                        BuiltinNames.builtInObjectTypes.includes(typeMeta.name)
                    ) {
                        const propertyIdx = this.getTruthIdx(
                            typeMeta,
                            typeMember,
                        );
                        return this.getBuiltinObjField(
                            objRef,
                            propertyIdx,
                            this.wasmTypeGen.getWASMType(ownerType),
                        );
                    } else {
                        return this.getInstProperty(
                            objRef,
                            ownerType,
                            typeMeta,
                            typeMember,
                        );
                    }
                }
            }
            case ValueTypeKind.ARRAY: {
                const objRef = this.wasmExprGen(owner);
                if (shapeMember.name === 'length') {
                    return FunctionalFuncs.getArrayRefLen(this.module, objRef);
                }
                throw Error(`unhandle Array field get: ${shapeMember.name}`);
            }
            case ValueTypeKind.STRING: {
                const objRef = this.wasmExprGen(owner);
                if (shapeMember.name === 'length') {
                    return FunctionalFuncs.getStringRefLen(this.module, objRef);
                }
                throw Error(`unhandle String field get: ${shapeMember.name}`);
            }
            default:
                throw new UnimplementError('Unimplement wasmObjFieldGet');
        }
    }

    getIndirectValueRef(
        objRef: binaryen.ExpressionRef,
        indexRef: binaryen.ExpressionRef,
        flagRef: binaryen.ExpressionRef,
        valueType: ValueType,
    ) {
        const propValueTypeRef = this.wasmTypeGen.getWASMValueType(valueType);
        const propTypeRef = this.wasmTypeGen.getWASMType(valueType);
        let realValueRef: binaryen.ExpressionRef;

        /* just for providing get_indirect path, not used in real custom envionment */
        if (propTypeRef === binaryen.i64) {
            return this.module.call(
                structdyn.StructDyn.struct_get_indirect_i64,
                [objRef, indexRef],
                binaryen.i64,
            );
        } else if (propTypeRef === binaryen.f32) {
            return this.module.call(
                structdyn.StructDyn.struct_get_indirect_f32,
                [objRef, indexRef],
                binaryen.f32,
            );
        }

        switch (valueType.kind) {
            case ValueTypeKind.INT:
            case ValueTypeKind.BOOLEAN: {
                realValueRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_i32,
                    [objRef, indexRef],
                    binaryen.i32,
                );
                break;
            }
            case ValueTypeKind.WASM_F32: {
                realValueRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_f32,
                    [objRef, indexRef],
                    binaryen.f32,
                );
                break;
            }
            case ValueTypeKind.WASM_I64: {
                realValueRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_i64,
                    [objRef, indexRef],
                    binaryen.i64,
                );
                break;
            }
            case ValueTypeKind.NUMBER: {
                realValueRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_f64,
                    [objRef, indexRef],
                    binaryen.f64,
                );
                break;
            }
            case ValueTypeKind.FUNCTION: {
                /* if is field, get from instance, cast to closureRef */
                const closureRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_anyref,
                    [objRef, indexRef],
                    binaryen.anyref,
                );
                const isFieldTrue = binaryenCAPI._BinaryenRefCast(
                    this.module.ptr,
                    closureRef,
                    propValueTypeRef,
                );
                /* if is method, get vtable firstly, then get method from vtable, finally box method to closureRef */
                const vtableRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_anyref,
                    [objRef, this.module.i32.const(0)],
                    binaryen.anyref,
                );
                const funcRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_funcref,
                    [vtableRef, indexRef],
                    binaryen.funcref,
                );
                const isMethodTrue = this.getClosureOfFunc(
                    binaryenCAPI._BinaryenRefCast(
                        this.module.ptr,
                        funcRef,
                        propTypeRef,
                    ),
                    valueType as FunctionType,
                    objRef,
                );
                realValueRef = this.module.if(
                    FunctionalFuncs.isFieldFlag(this.module, flagRef),
                    isFieldTrue,
                    this.module.if(
                        FunctionalFuncs.isMethodFlag(this.module, flagRef),
                        isMethodTrue,
                        this.module.unreachable(),
                    ),
                );
                break;
            }
            default: {
                realValueRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_anyref,
                    [objRef, indexRef],
                    binaryen.anyref,
                );
                if (this.wasmTypeGen.hasHeapType(valueType)) {
                    realValueRef = binaryenCAPI._BinaryenRefCast(
                        this.module.ptr,
                        realValueRef,
                        propValueTypeRef,
                    );
                }
                break;
            }
        }

        return realValueRef;
    }

    private dynGetInfcProperty(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: ValueType,
        isOptional: boolean,
        propTypeIdRef: binaryen.ExpressionRef,
    ) {
        const valueTypeRef = this.wasmTypeGen.getWASMValueType(valueType);
        const indexRef = FunctionalFuncs.getPropIndexFromObj(
            this.module,
            flagAndIndexRef,
        );
        const flagRef = FunctionalFuncs.getPropFlagFromObj(
            this.module,
            flagAndIndexRef,
        );

        const infcPropTypeIdRef = this.module.i32.const(
            FunctionalFuncs.getPredefinedTypeId(valueType),
        );
        const ifPropTypeIdCompatible = FunctionalFuncs.isPropTypeIdCompatible(
            this.module,
            infcPropTypeIdRef,
            propTypeIdRef,
        );
        let ifPropTypeIdEqualTrue = this.getIndirectValueRef(
            objRef,
            indexRef,
            flagRef,
            valueType,
        );
        if (isOptional) {
            ifPropTypeIdEqualTrue = this.module.if(
                FunctionalFuncs.isPropertyUnExist(this.module, flagAndIndexRef),
                FunctionalFuncs.generateDynUndefined(this.module),
                FunctionalFuncs.boxNonLiteralToAny(
                    this.module,
                    ifPropTypeIdEqualTrue,
                    valueType.kind,
                ),
            );
        }
        /* Hint for benchmark: here we add a comparation between two prop types, and an additional call for wasm function is called */
        /* TODO: reduce the additional call */
        /* if two prop type id is equal, we can use the prop type information get from compiler time */
        let ifPropTypeIdEqualFalse: binaryen.ExpressionRef;
        if (
            valueType instanceof UnionType ||
            (valueType instanceof FunctionType && isOptional)
        ) {
            /* For union type, we can parse type one by one to avoid runtime getting */
            /* For type T? (optional<T>):
             *  - when T is function type, it's regarded as T
             *  - otherwise it's regarded as union (T | undefined)
             */
            ifPropTypeIdEqualFalse = this.dynGetInfcUnionProperty(
                objRef,
                flagAndIndexRef,
                valueType,
                propTypeIdRef,
                isOptional,
            );
        } else {
            const anyTypedProperty = this.module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.getPropertyIfTypeIdMismatch,
                ),
                [
                    flagAndIndexRef,
                    infcPropTypeIdRef,
                    propTypeIdRef,
                    objRef,
                    FunctionalFuncs.getExtTagRefByTypeIdRef(
                        this.module,
                        propTypeIdRef,
                    ),
                ],
                binaryen.anyref,
            );
            ifPropTypeIdEqualFalse = FunctionalFuncs.unboxAny(
                this.module,
                anyTypedProperty,
                valueType.kind,
                valueTypeRef,
            );
        }

        return this.module.if(
            ifPropTypeIdCompatible,
            ifPropTypeIdEqualTrue,
            ifPropTypeIdEqualFalse,
        );
    }

    private dynGetInfcUnionProperty(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: UnionType | FunctionType,
        propertyTypeIdRef: binaryen.ExpressionRef,
        isOptional: boolean,
    ) {
        /**
         * For const foo: A | B | undefined
         * if A has been parsed, no need to parse B, because both they are class types,
         * here uses a Set to record the parsed types.
         */
        const parsedTypes: Set<ValueTypeKind> = new Set();
        let types: ValueType[] = [valueType];
        if (valueType instanceof UnionType) {
            types = Array.from(valueType.types);
        }

        const ifExpr = this.dynGetInfcUnionPropertyHelper(
            objRef,
            flagAndIndexRef,
            types[0],
            propertyTypeIdRef,
        );
        let curIfExpr = ifExpr;
        parsedTypes.add(types[0].kind);
        for (let i = 1; i < types.length; i++) {
            if (parsedTypes.has(types[i].kind)) {
                continue;
            }
            const ifExprOfIth = this.dynGetInfcUnionPropertyHelper(
                objRef,
                flagAndIndexRef,
                types[i],
                propertyTypeIdRef,
            );
            binaryenCAPI._BinaryenIfSetIfFalse(curIfExpr, ifExprOfIth);
            curIfExpr = ifExprOfIth;
            parsedTypes.add(types[i].kind);
        }

        if (isOptional) {
            binaryenCAPI._BinaryenIfSetIfFalse(
                curIfExpr,
                FunctionalFuncs.generateDynUndefined(this.module),
            );
        } else {
            binaryenCAPI._BinaryenIfSetIfFalse(
                curIfExpr,
                this.module.unreachable(),
            );
        }

        /* Use a block to wrap statement to make sure binaryen will treat the result type as anyref */
        return this.module.block(
            null,
            [
                this.module.if(
                    FunctionalFuncs.isPropertyUnExist(
                        this.module,
                        flagAndIndexRef,
                    ),
                    FunctionalFuncs.generateDynUndefined(this.module),
                    ifExpr,
                ),
            ],
            binaryen.anyref,
        );
    }

    private dynGetInfcUnionPropertyHelper(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: ValueType,
        propTypeIdRef: binaryen.ExpressionRef,
    ) {
        const indexRef = FunctionalFuncs.getPropIndexFromObj(
            this.module,
            flagAndIndexRef,
        );
        const flagRef = FunctionalFuncs.getPropFlagFromObj(
            this.module,
            flagAndIndexRef,
        );

        let condition: binaryen.ExpressionRef;
        const valueTypeId = FunctionalFuncs.getPredefinedTypeId(valueType);
        if (valueTypeId >= PredefinedTypeId.CUSTOM_TYPE_BEGIN) {
            condition = FunctionalFuncs.isPropTypeIdIsObject(
                this.module,
                propTypeIdRef,
            );
        } else {
            condition = FunctionalFuncs.isPropTypeIdCompatible(
                this.module,
                this.module.i32.const(valueTypeId),
                propTypeIdRef,
            );
        }
        const realValueRef = this.getIndirectValueRef(
            objRef,
            indexRef,
            flagRef,
            valueType,
        );
        const anyTypedRealValueRef = FunctionalFuncs.boxNonLiteralToAny(
            this.module,
            realValueRef,
            valueType.kind,
        );
        return this.module.if(condition, anyTypedRealValueRef);
    }

    setIndirectValueRef(
        objRef: binaryen.ExpressionRef,
        indexRef: binaryen.ExpressionRef,
        flagRef: binaryen.ExpressionRef,
        valueType: ValueType,
        valueRef: binaryen.ExpressionRef,
    ) {
        const propValueTypeRef = this.wasmTypeGen.getWASMValueType(valueType);
        const propTypeRef = this.wasmTypeGen.getWASMType(valueType);
        let res: binaryen.ExpressionRef;

        /* just for providing get_indirect path, not used in real custom envionment */
        if (propTypeRef === binaryen.i64) {
            return this.module.call(
                structdyn.StructDyn.struct_set_indirect_i64,
                [objRef, indexRef, valueRef],
                binaryen.none,
            );
        } else if (propTypeRef === binaryen.f32) {
            return this.module.call(
                structdyn.StructDyn.struct_set_indirect_f32,
                [objRef, indexRef, valueRef],
                binaryen.none,
            );
        }

        switch (valueType.kind) {
            case ValueTypeKind.INT:
            case ValueTypeKind.BOOLEAN: {
                res = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_i32,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                break;
            }
            case ValueTypeKind.WASM_F32: {
                res = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_f32,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                break;
            }
            case ValueTypeKind.WASM_I64: {
                res = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_i64,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                break;
            }
            case ValueTypeKind.NUMBER: {
                res = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_f64,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                break;
            }
            case ValueTypeKind.FUNCTION: {
                /* if is field, just set method to instance directly, we should ensure that the value is a closureRef */
                const isFieldTrue = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_anyref,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                /* if is method, get vtable firstly, then set method to vtable, we should unbox method from closureRef to funcRef */
                const vtableRef = this.module.call(
                    structdyn.StructDyn.struct_get_indirect_anyref,
                    [objRef, this.module.i32.const(0)],
                    binaryen.anyref,
                );
                const isMethodTrue = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_funcref,
                    [
                        vtableRef,
                        indexRef,
                        this.getFuncRefFromClosure(valueRef, propValueTypeRef),
                    ],
                    binaryen.none,
                );
                res = this.module.if(
                    FunctionalFuncs.isFieldFlag(this.module, flagRef),
                    isFieldTrue,
                    this.module.if(
                        FunctionalFuncs.isMethodFlag(this.module, flagRef),
                        isMethodTrue,
                        this.module.unreachable(),
                    ),
                );
                break;
            }
            default: {
                res = this.module.call(
                    structdyn.StructDyn.struct_set_indirect_anyref,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                );
                break;
            }
        }

        return res;
    }

    private dynSetInfcProperty(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: ValueType,
        isOptional: boolean,
        propTypeIdRef: binaryen.ExpressionRef,
        valueRef: binaryen.ExpressionRef,
    ) {
        const indexRef = FunctionalFuncs.getPropIndexFromObj(
            this.module,
            flagAndIndexRef,
        );
        const flagRef = FunctionalFuncs.getPropFlagFromObj(
            this.module,
            flagAndIndexRef,
        );

        const targetValueTypeIdRef = this.module.i32.const(
            FunctionalFuncs.getPredefinedTypeId(valueType),
        );
        const ifPropTypeIdCompatible = FunctionalFuncs.isPropTypeIdCompatible(
            this.module,
            propTypeIdRef,
            targetValueTypeIdRef,
        );
        const anyTypedProperty = FunctionalFuncs.boxNonLiteralToAny(
            this.module,
            valueRef,
            valueType.kind,
        );
        let ifPropTypeIdEqualTrue: binaryen.ExpressionRef =
            this.setIndirectValueRef(
                objRef,
                indexRef,
                flagRef,
                valueType,
                valueRef,
            );
        if (isOptional) {
            ifPropTypeIdEqualTrue = this.module.if(
                FunctionalFuncs.isPropertyUnExist(this.module, flagAndIndexRef),
                this.module.unreachable(),
                this.module.call(
                    structdyn.StructDyn.struct_set_indirect_anyref,
                    [objRef, indexRef, anyTypedProperty],
                    binaryen.none,
                ),
            );
        }
        let ifPropTypeIdEqualFalse: binaryen.ExpressionRef;
        if (
            valueType instanceof UnionType ||
            (valueType instanceof FunctionType && isOptional)
        ) {
            ifPropTypeIdEqualFalse = this.dynSetInfcUnionProperty(
                objRef,
                flagAndIndexRef,
                valueType,
                propTypeIdRef,
                isOptional,
                valueRef,
            );
        } else {
            ifPropTypeIdEqualFalse = this.module.call(
                UtilFuncs.getFuncName(
                    BuiltinNames.builtinModuleName,
                    BuiltinNames.setPropertyIfTypeIdMismatch,
                ),
                [
                    flagAndIndexRef,
                    targetValueTypeIdRef,
                    propTypeIdRef,
                    objRef,
                    anyTypedProperty,
                ],
                binaryen.none,
            );
        }

        return this.module.if(
            ifPropTypeIdCompatible,
            ifPropTypeIdEqualTrue,
            ifPropTypeIdEqualFalse,
        );
    }

    private dynSetInfcUnionProperty(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: UnionType | FunctionType,
        propTypeIdRef: binaryen.ExpressionRef,
        isOptional: boolean,
        valueRef: binaryen.ExpressionRef,
    ) {
        const parsedTypes: Set<ValueTypeKind> = new Set();
        let types: ValueType[] = [valueType];
        if (valueType instanceof UnionType) {
            types = Array.from(valueType.types);
        }
        const ifExpr = this.dynSetInfcUnionPropertyHelper(
            objRef,
            flagAndIndexRef,
            types[0],
            propTypeIdRef,
            valueRef,
        );
        parsedTypes.add(types[0].kind);
        let curIfExpr = ifExpr;
        for (let i = 1; i < types.length; i++) {
            if (parsedTypes.has(types[i].kind)) {
                continue;
            }
            const ifExprOfIth = this.dynSetInfcUnionPropertyHelper(
                objRef,
                flagAndIndexRef,
                types[i],
                propTypeIdRef,
                valueRef,
            );
            binaryenCAPI._BinaryenIfSetIfFalse(curIfExpr, ifExprOfIth);
            curIfExpr = ifExprOfIth;
            parsedTypes.add(types[i].kind);
        }

        if (isOptional) {
            const indexRef = FunctionalFuncs.getPropIndexFromObj(
                this.module,
                flagAndIndexRef,
            );
            binaryenCAPI._BinaryenIfSetIfFalse(
                curIfExpr,
                this.module.call(
                    structdyn.StructDyn.struct_set_indirect_anyref,
                    [objRef, indexRef, valueRef],
                    binaryen.none,
                ),
            );
        } else {
            binaryenCAPI._BinaryenIfSetIfFalse(
                curIfExpr,
                this.module.unreachable(),
            );
        }

        return this.module.if(
            FunctionalFuncs.isPropertyUnExist(this.module, flagAndIndexRef),
            this.module.unreachable(),
            ifExpr,
        );
    }

    private dynSetInfcUnionPropertyHelper(
        objRef: binaryen.ExpressionRef,
        flagAndIndexRef: binaryen.ExpressionRef,
        valueType: ValueType,
        propTypeIdRef: binaryen.ExpressionRef,
        valueRef: binaryen.ExpressionRef,
    ) {
        const indexRef = FunctionalFuncs.getPropIndexFromObj(
            this.module,
            flagAndIndexRef,
        );
        const flagRef = FunctionalFuncs.getPropFlagFromObj(
            this.module,
            flagAndIndexRef,
        );

        let condition: binaryen.ExpressionRef;
        const valueTypeId = FunctionalFuncs.getPredefinedTypeId(valueType);
        if (valueTypeId >= PredefinedTypeId.CUSTOM_TYPE_BEGIN) {
            condition = FunctionalFuncs.isPropTypeIdIsObject(
                this.module,
                propTypeIdRef,
            );
        } else {
            condition = FunctionalFuncs.isPropTypeIdCompatible(
                this.module,
                propTypeIdRef,
                this.module.i32.const(valueTypeId),
            );
        }
        const propValueTypeRef = this.wasmTypeGen.getWASMValueType(valueType);
        const typedValueRef = FunctionalFuncs.unboxAny(
            this.module,
            valueRef,
            valueType.kind,
            propValueTypeRef,
        );
        const res = this.setIndirectValueRef(
            objRef,
            indexRef,
            flagRef,
            valueType,
            typedValueRef,
        );
        return this.module.if(condition, res);
    }

    private wasmDirectGetter(value: DirectGetterValue) {
        const owner = value.owner as VarValue;
        const returnTypeRef = this.wasmTypeGen.getWASMType(value.type);
        const objRef = this.wasmExprGen(owner);

        const methodMangledName = (value.getter as any).index as string;

        return this.module.call(
            methodMangledName,
            [this.wasmCompiler.emptyRef, objRef],
            returnTypeRef,
        );
    }

    private wasmDirectSetter(value: DirectSetterValue) {
        const owner = value.owner as VarValue;
        const returnTypeRef = this.wasmTypeGen.getWASMType(value.type);
        const objRef = this.wasmExprGen(owner);

        const methodMangledName = (value.setter as any).index as string;

        return this.module.call(
            methodMangledName,
            [
                this.wasmCompiler.emptyRef,
                objRef,
                this.wasmExprGen(value.value!),
            ],
            binaryen.none,
        );
    }

    private getTruthIdx(
        meta: ObjectDescription,
        member: MemberDescription,
        isSetter = false,
    ) {
        /* The index provided by semantic tree is unrealiable, we must recompute it */
        let valueIdx = 0;
        if (member.type === MemberType.FIELD) {
            valueIdx = this.fixFieldIndex(meta, member);
        } else {
            valueIdx = this.fixVtableIndex(meta, member, isSetter);
        }
        return valueIdx;
    }

    private getMemberByName(meta: ObjectDescription, propName: string) {
        let foundMember: MemberDescription | undefined = undefined;
        for (const member of meta.members) {
            if (member.name === propName) {
                foundMember = member;
                break;
            }
        }
        if (!foundMember) {
            throw Error(`not found ${propName} in getMemberByName`);
        }
        return foundMember;
    }

    private wasmDynamicGet(value: DynamicGetValue) {
        const owner = value.owner;
        const propName = value.name;
        const propNameRef = this.getStringOffset(propName);
        switch (owner.type.kind) {
            case ValueTypeKind.ANY: {
                const ownValueRef = this.wasmExprGen(owner);
                return FunctionalFuncs.getDynObjProp(
                    this.module,
                    ownValueRef,
                    propNameRef,
                );
            }
            case ValueTypeKind.UNION: {
                const ownValueRef = this.wasmExprGen(owner);
                const dynamicGetProp = FunctionalFuncs.getDynObjProp(
                    this.module,
                    ownValueRef,
                    propNameRef,
                );
                if (FunctionalFuncs.isUnionWithUndefined(owner.type)) {
                    const isNonUndefined = FunctionalFuncs.generateCondition(
                        this.module,
                        ownValueRef,
                        ValueTypeKind.UNION,
                    );
                    const staticType = FunctionalFuncs.getStaticType(
                        owner.type,
                    );
                    const wasmStaticType =
                        this.wasmTypeGen.getWASMValueType(staticType);
                    let ownerStaticValueRef = FunctionalFuncs.unboxAny(
                        this.module,
                        ownValueRef,
                        staticType.kind,
                        wasmStaticType,
                    );
                    ownerStaticValueRef = binaryenCAPI._BinaryenRefCast(
                        this.module.ptr,
                        ownerStaticValueRef,
                        wasmStaticType,
                    );

                    let propValueRef: binaryen.ExpressionRef;
                    let propType: ValueType;
                    if (
                        staticType.kind === ValueTypeKind.STRING &&
                        propName === 'length'
                    ) {
                        propValueRef = FunctionalFuncs.getStringRefLen(
                            this.module,
                            ownerStaticValueRef,
                        );
                        propType = Primitive.Number;
                    } else if (
                        staticType.kind === ValueTypeKind.ARRAY &&
                        propName === 'length'
                    ) {
                        propValueRef = FunctionalFuncs.getArrayRefLen(
                            this.module,
                            ownerStaticValueRef,
                        );
                        propType = Primitive.Number;
                    } else if (staticType instanceof ObjectType) {
                        const member = this.getMemberByName(
                            staticType.meta,
                            propName,
                        );
                        propValueRef = this.getInstProperty(
                            ownerStaticValueRef,
                            staticType,
                            staticType.meta,
                            member,
                        );
                        propType = member.valueType;
                    } else {
                        return dynamicGetProp;
                    }
                    propValueRef =
                        propType instanceof PrimitiveType ||
                        propType instanceof UnionType
                            ? FunctionalFuncs.boxBaseTypeToAny(
                                  this.module,
                                  propValueRef,
                                  propType.kind,
                              )
                            : FunctionalFuncs.generateDynExtrefByTypeKind(
                                  this.module,
                                  propValueRef,
                                  propType.kind,
                              );
                    return this.module.if(
                        isNonUndefined,
                        propValueRef,
                        FunctionalFuncs.generateDynUndefined(this.module),
                    );
                } else {
                    return dynamicGetProp;
                }
            }
            case ValueTypeKind.OBJECT: {
                const meta = (owner.type as ObjectType).meta;
                const foundMember = this.getMemberByName(meta, propName);
                const propertyIdx = this.getTruthIdx(meta, foundMember);

                if (meta.isObjectClass) {
                    /* class A; A.yy */
                    /* workaround: class get static field is a ShapeGetValue, this can be deleted later */
                    return this.getClassStaticField(
                        foundMember,
                        meta,
                        owner.type as ObjectType,
                    );
                } else {
                    /* let a: A = xx; a.yy */
                    /* let o = {xx}; o.yy */
                    const ownValueRef = this.wasmExprGen(owner);
                    return this.getObjProperty(
                        foundMember,
                        owner.type,
                        ownValueRef,
                        propertyIdx,
                    );
                }
            }
            case ValueTypeKind.ARRAY: {
                if (propName === 'length') {
                    const ownValueRef = this.wasmExprGen(owner);
                    return FunctionalFuncs.getArrayRefLen(
                        this.module,
                        ownValueRef,
                    );
                }
                throw Error(`unhandle Array field get: ${propName}`);
            }
            case ValueTypeKind.STRING: {
                if (propName === 'length') {
                    const ownValueRef = this.wasmExprGen(owner);
                    return FunctionalFuncs.getStringRefLen(
                        this.module,
                        ownValueRef,
                    );
                }
                throw Error(`unhandle String field get: ${propName}`);
            }
            default:
                throw Error(`wasmDynamicGet: ${value}`);
        }
    }

    private wasmDynamicSet(value: DynamicSetValue) {
        const oriValue = value.value!;
        const oriValueRef = this.wasmExprGen(oriValue);
        const ownVarDecl = (value.owner as VarValue).ref as VarDeclareNode;
        const ownValueRef = this.wasmExprGen(value.owner);
        switch (ownVarDecl.type.kind) {
            case ValueTypeKind.ANY: {
                /* set any prop */
                const propNameRef = this.getStringOffset(value.name);
                const initValueToAnyRef = FunctionalFuncs.boxToAny(
                    this.module,
                    oriValueRef,
                    oriValue,
                );
                return this.module.drop(
                    FunctionalFuncs.setDynObjProp(
                        this.module,
                        ownValueRef,
                        propNameRef,
                        initValueToAnyRef,
                    ),
                );
            }
            case ValueTypeKind.OBJECT: {
                const objType = ownVarDecl.type as ObjectType;
                const typeMeta = objType.meta;
                const typeMember = this.getMemberByName(typeMeta, value.name);
                return this.setInstProperty(
                    ownValueRef,
                    objType,
                    typeMeta,
                    typeMember,
                    oriValue,
                );
            }
            default:
                throw Error(`wasmDynamicSet: ${value}`);
        }
    }

    private wasmNewLiteralArray(value: NewLiteralArrayValue) {
        return this.wasmElemsToArr(value.initValues, value.type as ArrayType);
    }

    private wasmNewArray(value: NewArrayValue | NewArrayLenValue) {
        let arrayRef: binaryen.ExpressionRef;
        let arraySizeRef: binaryen.ExpressionRef;
        const arrayHeapType = this.wasmTypeGen.getWASMArrayOriHeapType(
            value.type,
        );
        const arrayStructHeapType = this.wasmTypeGen.getWASMHeapType(
            value.type,
        );

        if (value instanceof NewArrayValue) {
            const arrayLen = value.parameters.length;
            const elemRefs: binaryen.ExpressionRef[] = [];
            for (let i = 0; i < arrayLen; i++) {
                const elemRef = this.wasmExprGen(value.parameters[i]);
                elemRefs.push(elemRef);
            }
            arrayRef = binaryenCAPI._BinaryenArrayNewFixed(
                this.module.ptr,
                arrayHeapType,
                arrayToPtr(elemRefs).ptr,
                arrayLen,
            );
            arraySizeRef = this.module.i32.const(arrayLen);
        } else if (value instanceof NewArrayLenValue) {
            const arrayInit = this.getArrayInitFromArrayType(
                <ArrayType>value.type,
            );
            arraySizeRef = FunctionalFuncs.convertTypeToI32(
                this.module,
                this.wasmExprGen(value.len),
            );

            arrayRef = binaryenCAPI._BinaryenArrayNew(
                this.module.ptr,
                arrayHeapType,
                arraySizeRef,
                arrayInit,
            );
        }

        const arrayStructRef = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([arrayRef!, arraySizeRef!]).ptr,
            2,
            arrayStructHeapType,
        );
        return arrayStructRef;
    }

    private elemOp(value: ElementGetValue | ElementSetValue) {
        const ownerRef = this.wasmExprGen(value.owner);
        let valueType = value.type;
        if (value.kind === SemanticsValueKind.OBJECT_KEY_SET) {
            valueType = (value as ElementSetValue).value!.type;
        }
        const indexStrRef = this.wasmExprGen(value.index);
        const propertyOffset = this.encodeStringrefToLinearMemory(indexStrRef);

        /* invoke get_indirect/set_indirect to set prop value to obj */
        const metaRef = FunctionalFuncs.getWASMObjectMeta(
            this.module,
            ownerRef,
        );
        const flag = ItableFlag.ALL;
        const flagAndIndexRef = this.getPropFlagAndIdxRefFromObj(
            metaRef,
            propertyOffset,
            flag,
        );
        const propTypeIdRef = this.getPropTypeIdRefFromObj(
            metaRef,
            propertyOffset,
            flag,
        );
        let elemOperation: binaryen.ExpressionRef;
        if (value.kind === SemanticsValueKind.OBJECT_KEY_SET) {
            elemOperation = this.dynSetInfcProperty(
                ownerRef,
                flagAndIndexRef,
                valueType,
                false,
                propTypeIdRef,
                this.wasmExprGen((value as ElementSetValue).value!),
            );
        } else {
            elemOperation = this.dynGetInfcProperty(
                ownerRef,
                flagAndIndexRef,
                valueType,
                false,
                propTypeIdRef,
            );
        }
        return elemOperation;
    }

    private wasmElemGet(value: ElementGetValue) {
        const owner = value.owner;
        const ownerType = owner.type;
        switch (ownerType.kind) {
            case ValueTypeKind.ARRAY: {
                const ownerRef = this.wasmExprGen(owner);
                const idxI32Ref = FunctionalFuncs.convertTypeToI32(
                    this.module,
                    this.wasmExprGen(value.index),
                );
                const elemTypeRef = this.wasmTypeGen.getWASMType(
                    (ownerType as ArrayType).element,
                );
                const ownerHeapTypeRef =
                    this.wasmTypeGen.getWASMHeapType(ownerType);
                return FunctionalFuncs.getArrayElemByIdx(
                    this.module,
                    elemTypeRef,
                    ownerRef,
                    ownerHeapTypeRef,
                    idxI32Ref,
                );
            }
            /* workaround: sometimes semantic tree will treat array as any
             * test case: array_class2 in array_push.ts
             * However, this case need to reserve.
             */
            case ValueTypeKind.ANY: {
                const ownerRef = this.wasmExprGen(owner);
                const idxRef = this.wasmExprGen(value.index);
                const idxI32Ref = FunctionalFuncs.convertTypeToI32(
                    this.module,
                    idxRef,
                );
                switch (value.index.type.kind) {
                    case ValueTypeKind.NUMBER:
                    case ValueTypeKind.INT: {
                        const elemGetInArrRef = FunctionalFuncs.getDynArrElem(
                            this.module,
                            ownerRef,
                            idxI32Ref,
                        );
                        return elemGetInArrRef;
                    }
                    default: {
                        const propertyOffset =
                            this.encodeStringrefToLinearMemory(idxRef);
                        const elemGetInObjRef = FunctionalFuncs.getDynObjProp(
                            this.module,
                            ownerRef,
                            propertyOffset,
                        );
                        return elemGetInObjRef;
                    }
                }
            }
            case ValueTypeKind.STRING: {
                const ownerRef = this.wasmExprGen(owner);
                const idxF64Ref = FunctionalFuncs.convertTypeToF64(
                    this.module,
                    this.wasmExprGen(value.index),
                );
                if (getConfig().enableStringRef) {
                    const invokeArgs = [
                        new CastValue(
                            SemanticsValueKind.VALUE_CAST_ANY,
                            owner.type,
                            owner,
                        ) as SemanticsValue,
                        value.index,
                    ];
                    return this.module.call(
                        dyntype.dyntype_to_string,
                        [
                            FunctionalFuncs.getDynContextRef(this.module),
                            this.dyntypeInvoke('charAt', invokeArgs),
                        ],
                        binaryenCAPI._BinaryenTypeStringref(),
                    );
                }

                return this.module.call(
                    getBuiltInFuncName(BuiltinNames.stringcharAtFuncName),
                    [this.wasmCompiler.emptyRef, ownerRef, idxF64Ref],
                    stringTypeInfo.typeRef,
                );
            }
            case ValueTypeKind.OBJECT: {
                return this.elemOp(value);
            }
            default:
                throw Error(`wasmIdxGet: ${value}`);
        }
    }

    private wasmElemSet(value: ElementSetValue) {
        const owner = value.owner as VarValue;
        const ownerType = owner.type;
        switch (ownerType.kind) {
            case ValueTypeKind.ARRAY: {
                const ownerRef = this.wasmExprGen(owner);
                const idxI32Ref = FunctionalFuncs.convertTypeToI32(
                    this.module,
                    this.wasmExprGen(value.index),
                );
                const targetValueRef = this.wasmExprGen(value.value!);
                const ownerHeapTypeRef =
                    this.wasmTypeGen.getWASMHeapType(ownerType);
                const arrayOriRef = binaryenCAPI._BinaryenStructGet(
                    this.module.ptr,
                    0,
                    ownerRef,
                    ownerHeapTypeRef,
                    false,
                );
                return binaryenCAPI._BinaryenArraySet(
                    this.module.ptr,
                    arrayOriRef,
                    idxI32Ref,
                    targetValueRef,
                );
            }
            case ValueTypeKind.ANY: {
                const ownerRef = this.wasmExprGen(owner);
                const idxRef = this.wasmExprGen(value.index);
                const idxI32Ref = FunctionalFuncs.convertTypeToI32(
                    this.module,
                    idxRef,
                );
                const targetValueRef = this.wasmExprGen(value.value!);
                switch (value.index.type.kind) {
                    case ValueTypeKind.NUMBER:
                    case ValueTypeKind.INT: {
                        const elemSetInArrRef = FunctionalFuncs.setDynArrElem(
                            this.module,
                            ownerRef,
                            idxI32Ref,
                            targetValueRef,
                        );
                        return elemSetInArrRef;
                    }
                    default: {
                        const propertyOffset =
                            this.encodeStringrefToLinearMemory(idxRef);
                        const elemSetInObjRef = FunctionalFuncs.setDynObjProp(
                            this.module,
                            ownerRef,
                            propertyOffset,
                            targetValueRef,
                        );
                        return elemSetInObjRef;
                    }
                }
            }
            case ValueTypeKind.OBJECT: {
                return this.elemOp(value);
            }
            default:
                throw Error(`wasmIdxSet: ${value}`);
        }
    }

    private wasmBlockValue(value: BlockValue) {
        const blockArray: binaryen.ExpressionRef[] = [];
        for (const blockValue of value.values) {
            blockArray.push(this.wasmExprGen(blockValue));
        }

        return this.module.block(
            value.label,
            blockArray,
            this.wasmTypeGen.getWASMType(value.type),
        );
    }

    private wasmBlockIFValue(value: BlockBranchIfValue) {
        const oriCondRef = this.wasmExprGen(value.condition);
        const targetRef = this.wasmExprGen(value.target);
        const isTrueBranch = value.trueBranch;
        let condRef: binaryen.ExpressionRef;
        if (isTrueBranch) {
            condRef = oriCondRef;
        } else {
            condRef = this.module.i32.eqz(oriCondRef);
        }
        return this.module.if(condRef, targetRef);
    }

    private wasmBlockBranchValue(value: BlockBranchValue) {
        const targetLabel = value.target.label;
        return this.module.br(targetLabel);
    }

    private getArrayInitFromArrayType(
        arrayType: ArrayType,
    ): binaryen.ExpressionRef {
        const module = this.module;
        const elemType = arrayType.element;
        switch (elemType.kind) {
            case ValueTypeKind.NUMBER: {
                return module.f64.const(0);
            }
            case ValueTypeKind.STRING: {
                if (getConfig().enableStringRef) {
                    return this.createStringRef('');
                } else {
                    return FunctionalFuncs.generateStringForStructArrayStr(
                        this.module,
                        '',
                    );
                }
            }
            case ValueTypeKind.BOOLEAN: {
                return module.i32.const(0);
            }
            case ValueTypeKind.FUNCTION: {
                return binaryenCAPI._BinaryenRefNull(
                    module.ptr,
                    builtinClosureType.typeRef,
                );
            }
            default: {
                return binaryenCAPI._BinaryenRefNull(
                    module.ptr,
                    this.wasmTypeGen.getWASMType(elemType),
                );
            }
        }
    }

    private generateDynamicArg(args?: Array<SemanticsValue>) {
        const restArgs = args
            ? args.map((a) => {
                  return FunctionalFuncs.boxToAny(
                      this.module,
                      this.wasmExprGen(a),
                      a,
                  );
              })
            : [];
        const tmpArgVar = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
            dyntype.dyn_value_t,
        );
        const createDynObjOps: binaryen.ExpressionRef[] = [];
        const setDynamicArg = this.module.local.set(
            tmpArgVar.index,
            FunctionalFuncs.generateDynArray(
                this.module,
                this.module.i32.const(restArgs.length),
            ),
        );
        createDynObjOps.push(setDynamicArg);
        for (let i = 0; i < restArgs.length; i++) {
            createDynObjOps.push(
                FunctionalFuncs.setDynArrElem(
                    this.module,
                    this.module.local.get(tmpArgVar.index, dyntype.dyn_value_t),
                    this.module.i32.const(i),
                    restArgs[i],
                ),
            );
        }
        this.wasmCompiler.currentFuncCtx!.insert(
            this.module.block(null, createDynObjOps),
        );

        return this.module.local.get(tmpArgVar.index, dyntype.dyn_value_t);
    }

    /** the dynamic object will fallback to libdyntype */
    private dyntypeInvoke(
        name: string,
        args: Array<SemanticsValue>,
        isNew = false,
    ): binaryen.ExpressionRef {
        const namePointer = this.wasmCompiler.generateRawString(name);
        const thisArg = !isNew
            ? this.wasmExprGen(args.splice(0, 1)[0])
            : undefined;
        const dynamicArg = this.generateDynamicArg(args);
        const finalArgs = [
            FunctionalFuncs.getDynContextRef(this.module),
            this.module.i32.const(namePointer),
        ];

        if (!isNew) {
            finalArgs.push(thisArg!);
        }

        finalArgs.push(dynamicArg);

        const res = this.module.call(
            isNew
                ? dyntype.dyntype_new_object_with_class
                : dyntype.dyntype_invoke,
            finalArgs,
            dyntype.dyn_value_t,
        );
        return res;
    }

    private wasmTypeof(value: TypeofValue): binaryen.ExpressionRef {
        const expr = this.wasmExprGen(value.value);
        const res = this.module.call(
            dyntype.dyntype_typeof,
            [
                this.module.global.get(
                    dyntype.dyntype_context,
                    binaryen.anyref,
                ),
                expr,
            ],
            stringTypeInfo.typeRef,
        );
        return res;
    }

    private wasmTemplateExpr(value: TemplateExprValue): binaryen.ExpressionRef {
        const head = this.wasmExprGen(value.head);
        // create a string array;
        const follows = value.follows;
        const followsExprRef: binaryen.ExpressionRef[] = [];
        const stringArrayType = getConfig().enableStringRef
            ? stringrefArrayTypeInfo
            : stringArrayTypeInfo;
        const stringArrayStructType = getConfig().enableStringRef
            ? stringrefArrayStructTypeInfo
            : stringArrayStructTypeInfo;

        for (const follow of follows) {
            followsExprRef.push(this.wasmExprGen(follow));
        }

        const arrayValue = binaryenCAPI._BinaryenArrayNewFixed(
            this.module.ptr,
            stringArrayType.heapTypeRef,
            arrayToPtr(followsExprRef).ptr,
            followsExprRef.length,
        );
        const arrayStructValue = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([arrayValue, this.module.i32.const(follows.length)]).ptr,
            2,
            stringArrayStructType.heapTypeRef,
        );
        return this.module.call(
            UtilFuncs.getFuncName(
                BuiltinNames.builtinModuleName,
                BuiltinNames.stringConcatFuncName,
            ),
            [
                this.module.ref.null(stringArrayType.typeRef),
                head,
                arrayStructValue,
            ],
            stringTypeInfo.typeRef,
        );
    }

    private wasmToString(value: ToStringValue): binaryen.ExpressionRef {
        const expr = this.wasmExprGen(value.value);
        const boxedExpr = FunctionalFuncs.boxToAny(
            this.module,
            expr,
            value.value,
        );
        const res = this.module.call(
            dyntype.dyntype_toString,
            [
                this.module.global.get(
                    dyntype.dyntype_context,
                    binaryen.anyref,
                ),
                boxedExpr,
            ],
            getConfig().enableStringRef
                ? binaryenCAPI._BinaryenTypeStringref()
                : stringTypeInfo.typeRef,
        );
        return res;
    }

    private wasmObjTypeCastToAny(value: CastValue) {
        const fromValue = value.value;
        const fromType = fromValue.type;
        const fromObjType = fromType as ObjectType;

        /* Workaround: semantic tree treat Map/Set as ObjectType,
            then they will be boxed to extref. Here we avoid this
            cast if we find the actual object should be fallbacked
            to libdyntype */
        if (
            fromObjType.meta &&
            BuiltinNames.fallbackConstructors.includes(fromObjType.meta.name)
        ) {
            const fromValueRef = this.wasmExprGen(fromValue);
            return fromValueRef;
        }
        let castedValueRef: binaryen.ExpressionRef;
        if (fromValue instanceof NewLiteralArrayValue) {
            const arrLen = fromValue.initValues.length;
            const currentFuncCtx = this.wasmCompiler.currentFuncCtx!;
            const arrLenVar = currentFuncCtx.i32Local();
            const initArrLenStmt = this.module.local.set(
                arrLenVar.index,
                this.module.i32.const(0),
            );
            currentFuncCtx.insert(initArrLenStmt);
            // compute the true length of new array
            for (let i = 0; i < arrLen; ++i) {
                const initValue = fromValue.initValues[i];
                if (initValue instanceof SpreadValue) {
                    const propLenRef = this.getStringOffset('length');
                    const arrLenRef = FunctionalFuncs.getArrayRefLen(
                        this.module,
                        this.wasmExprGen(initValue.target),
                        initValue.target,
                        propLenRef,
                        true,
                    );
                    const incStmt = this.module.local.set(
                        arrLenVar.index,
                        this.module.i32.add(
                            this.module.local.get(
                                arrLenVar.index,
                                arrLenVar.type,
                            ),
                            arrLenRef,
                        ),
                    );
                    currentFuncCtx.insert(incStmt);
                } else {
                    const incStmt = this.module.local.set(
                        arrLenVar.index,
                        this.module.i32.add(
                            this.module.local.get(
                                arrLenVar.index,
                                arrLenVar.type,
                            ),
                            this.module.i32.const(1),
                        ),
                    );
                    currentFuncCtx.insert(incStmt);
                }
            }
            castedValueRef = FunctionalFuncs.boxLiteralToAny(
                this.module,
                fromValue,
                this.module.local.get(arrLenVar.index, arrLenVar.type),
            );
        } else if (fromValue instanceof NewLiteralObjectValue) {
            castedValueRef = FunctionalFuncs.boxLiteralToAny(
                this.module,
                fromValue,
            );
        } else {
            const fromValueRef = this.wasmExprGen(fromValue);
            castedValueRef = FunctionalFuncs.boxToAny(
                this.module,
                fromValueRef,
                fromValue,
            );
        }

        if (
            fromValue instanceof NewLiteralObjectValue ||
            fromValue instanceof NewLiteralArrayValue
        ) {
            /* created a temVar to store dynObjValue, then set dyn property */
            const tmpVar = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                this.wasmTypeGen.getWASMType(Primitive.Any),
            );
            const createDynObjOps: binaryen.ExpressionRef[] = [];
            createDynObjOps.push(
                this.module.local.set(tmpVar.index, castedValueRef),
            );
            const forLoopIdx = this.wasmCompiler.currentFuncCtx!.i32Local();
            const curElemIdx = this.wasmCompiler.currentFuncCtx!.i32Local();
            this.wasmCompiler.currentFuncCtx!.insert(
                this.module.local.set(
                    curElemIdx.index,
                    this.module.i32.const(0),
                ),
            );
            for (let i = 0; i < fromValue.initValues.length; i++) {
                const initValue = fromValue.initValues[i];
                let initValueRef = this.wasmExprGen(initValue);
                if (fromValue instanceof NewLiteralObjectValue) {
                    const propName = fromObjType.meta.members[i].name;
                    const propNameRef = this.getStringOffset(propName);
                    createDynObjOps.push(
                        FunctionalFuncs.setDynObjProp(
                            this.module,
                            this.module.local.get(tmpVar.index, tmpVar.type),
                            propNameRef,
                            initValueRef,
                        ),
                    );
                } else {
                    if (initValue instanceof SpreadValue) {
                        const spreadValue = initValue;
                        const propLenRef = this.getStringOffset('length');
                        const arrLenRef = FunctionalFuncs.getArrayRefLen(
                            this.module,
                            this.wasmExprGen(spreadValue.target),
                            spreadValue.target,
                            propLenRef,
                            true,
                        );
                        const for_label = 'for_loop_block';
                        const for_init = this.module.local.set(
                            forLoopIdx.index,
                            this.module.i32.const(0),
                        );
                        const for_condition = this.module.i32.lt_u(
                            this.module.local.get(
                                forLoopIdx.index,
                                forLoopIdx.type,
                            ),
                            arrLenRef,
                        );
                        const for_incrementor = this.module.local.set(
                            forLoopIdx.index,
                            this.module.i32.add(
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                                this.module.i32.const(1),
                            ),
                        );
                        let getArrElemStmt: binaryen.ExpressionRef | undefined;
                        if (
                            spreadValue.target.type.kind == ValueTypeKind.ARRAY
                        ) {
                            const arrayOriHeapType =
                                this.wasmTypeGen.getWASMArrayOriHeapType(
                                    spreadValue.target.type,
                                );
                            const arrRef = initValueRef;
                            getArrElemStmt = binaryenCAPI._BinaryenArrayGet(
                                this.module.ptr,
                                arrRef,
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                                arrayOriHeapType,
                                false,
                            );
                            // box the element by dyntype_new_xxx
                            const elemType = (
                                spreadValue.target.type as ArrayType
                            ).element;
                            if (elemType.isPrimitive) {
                                getArrElemStmt =
                                    FunctionalFuncs.boxBaseTypeToAny(
                                        this.module,
                                        getArrElemStmt,
                                        elemType.kind,
                                    );
                            } else {
                                getArrElemStmt = FunctionalFuncs.boxToAny(
                                    this.module,
                                    this.wasmExprGen(spreadValue.target),
                                    spreadValue.target,
                                );
                            }
                        } else if (
                            spreadValue.target.type.kind == ValueTypeKind.ANY
                        ) {
                            getArrElemStmt = FunctionalFuncs.getDynArrElem(
                                this.module,
                                initValueRef,
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                            );
                        }
                        const for_body = this.module.block(null, [
                            FunctionalFuncs.setDynArrElem(
                                this.module,
                                this.module.local.get(
                                    tmpVar.index,
                                    tmpVar.type,
                                ),
                                this.module.local.get(
                                    curElemIdx.index,
                                    curElemIdx.type,
                                ),
                                getArrElemStmt!,
                            ),
                            this.module.local.set(
                                curElemIdx.index,
                                this.module.i32.add(
                                    this.module.local.get(
                                        curElemIdx.index,
                                        curElemIdx.type,
                                    ),
                                    this.module.i32.const(1),
                                ),
                            ),
                        ]);

                        const flattenLoop: FlattenLoop = {
                            label: for_label,
                            condition: for_condition,
                            statements: for_body,
                            incrementor: for_incrementor,
                        };

                        createDynObjOps.push(for_init);
                        createDynObjOps.push(
                            this.module.loop(
                                for_label,
                                FunctionalFuncs.flattenLoopStatement(
                                    this.module,
                                    flattenLoop,
                                    SemanticsKind.FOR,
                                ),
                            ),
                        );
                    } else {
                        initValueRef = FunctionalFuncs.boxToAny(
                            this.module,
                            initValueRef,
                            initValue,
                        );
                        createDynObjOps.push(
                            FunctionalFuncs.setDynArrElem(
                                this.module,
                                this.module.local.get(
                                    tmpVar.index,
                                    tmpVar.type,
                                ),
                                this.module.local.get(
                                    curElemIdx.index,
                                    curElemIdx.type,
                                ),
                                initValueRef,
                            ),
                            this.module.local.set(
                                curElemIdx.index,
                                this.module.i32.add(
                                    this.module.local.get(
                                        curElemIdx.index,
                                        curElemIdx.type,
                                    ),
                                    this.module.i32.const(1),
                                ),
                            ),
                        );
                    }
                }
            }
            createDynObjOps.push(
                this.module.local.get(tmpVar.index, tmpVar.type),
            );
            castedValueRef = this.module.block(null, createDynObjOps);
        }
        return castedValueRef;
    }

    private createTmpVarOfSpecifiedType(
        expr: binaryen.ExpressionRef,
        type: ValueType,
    ) {
        const ctx = this.wasmCompiler.currentFuncCtx!;
        const tmpVar = ctx.insertTmpVar(this.wasmTypeGen.getWASMType(type));
        ctx.insert(this.module.local.set(tmpVar.index, expr));
        return this.module.local.get(tmpVar.index, tmpVar.type);
    }

    private wasmReBinding(value: ReBindingValue) {
        const ctxVar = value.contextVar;
        const ctxType = ctxVar.type as ClosureContextType;
        const ctxTypeRef = this.wasmTypeGen.getWASMType(ctxType);
        const ctxHeapTypeRef = this.wasmTypeGen.getWASMHeapType(ctxType);
        const fields: binaryen.ExpressionRef[] = [];
        fields.push(
            binaryenCAPI._BinaryenStructGet(
                this.module.ptr,
                0,
                this.module.local.get(ctxVar.index, ctxTypeRef),
                ctxTypeRef,
                false,
            ),
        );
        for (let i = 0; i < ctxType.freeVarTypeList.length; i++) {
            fields.push(
                binaryenCAPI._BinaryenStructGet(
                    this.module.ptr,
                    i + 1,
                    this.module.local.get(ctxVar.index, ctxTypeRef),
                    ctxTypeRef,
                    false,
                ),
            );
        }
        const newCtxStruct = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr(fields).ptr,
            fields.length,
            ctxHeapTypeRef,
        );
        return this.module.local.set(ctxVar.index, newCtxStruct);
    }

    private wasmSpread(value: SpreadValue) {
        const target = value.target;
        if (target.type.kind == ValueTypeKind.ARRAY) {
            const arrayStructRef = this.wasmExprGen(target);
            const arrayStructHeapType = this.wasmTypeGen.getWASMHeapType(
                target.type,
            );
            const arrayRef = binaryenCAPI._BinaryenStructGet(
                this.module.ptr,
                0,
                arrayStructRef,
                arrayStructHeapType,
                false,
            );
            return arrayRef;
        } else if (target.type.kind == ValueTypeKind.ANY) {
            return this.wasmExprGen(target);
        }
        throw Error('not implemented');
    }

    private wasmElemsToArr(values: SemanticsValue[], arrType: ArrayType) {
        const arrayLen = values.length;
        let elemRefs: binaryen.ExpressionRef[] = [];
        const srcArrRefs: binaryen.ExpressionRef[] = [];
        const arrayOriHeapType =
            this.wasmTypeGen.getWASMArrayOriHeapType(arrType);
        const arrayStructHeapType = this.wasmTypeGen.getWASMHeapType(arrType);
        const elemType = arrType.element;
        const statementArray: binaryenCAPI.ExpressionRef[] = [];
        for (let i = 0; i < arrayLen; i++) {
            let elemValue = values[i];
            if (
                elemType.kind != ValueTypeKind.ANY &&
                (elemValue.kind == SemanticsValueKind.VALUE_CAST_ANY ||
                    elemValue.kind == SemanticsValueKind.OBJECT_CAST_ANY)
            ) {
                elemValue = (elemValue as CastValue).value;
            }
            let elemRef = this.wasmExprGen(elemValue);
            if (elemValue.type.kind === ValueTypeKind.INT) {
                /* Currently there is no Array<int>, int in array init
                    sequence should be coverted to number */
                elemRef = this.module.f64.convert_u.i32(elemRef);
            }
            if (elemValue.kind == SemanticsValueKind.SPREAD) {
                if (elemRefs.length != 0) {
                    const elemArrRef = binaryenCAPI._BinaryenArrayNewFixed(
                        this.module.ptr,
                        arrayOriHeapType,
                        arrayToPtr(elemRefs).ptr,
                        elemRefs.length,
                    );
                    const elemArrLocal =
                        this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                            binaryen.getExpressionType(elemArrRef),
                        );

                    const setElemArrLocalStmt = this.module.local.set(
                        elemArrLocal.index,
                        elemArrRef,
                    );
                    const getElemArrLocalStmt = this.module.local.get(
                        elemArrLocal.index,
                        elemArrLocal.type,
                    );
                    statementArray.push(setElemArrLocalStmt);
                    srcArrRefs.push(getElemArrLocalStmt);
                    elemRefs = [];
                }
                const target = (elemValue as SpreadValue).target;
                if (target.type.kind == ValueTypeKind.ARRAY) {
                    // box to interface
                    const targetElemType = (target.type as ArrayType).element;
                    if (
                        elemType instanceof ObjectType &&
                        elemType.meta.isInterface &&
                        targetElemType instanceof ObjectType &&
                        (targetElemType.meta.type ==
                            ObjectDescriptionType.OBJECT_INSTANCE ||
                            targetElemType.meta.type ==
                                ObjectDescriptionType.OBJECT_CLASS ||
                            targetElemType.meta.type ==
                                ObjectDescriptionType.OBJECT_LITERAL)
                    ) {
                        const arrLenRef = binaryenCAPI._BinaryenArrayLen(
                            this.module.ptr,
                            elemRef,
                        );
                        const newArrRef = binaryenCAPI._BinaryenArrayNew(
                            this.module.ptr,
                            arrayOriHeapType,
                            arrLenRef,
                            binaryen.none,
                        );
                        const newArrLocal =
                            this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                                binaryen.getExpressionType(newArrRef),
                            );
                        const setNewArrLocalStmt = this.module.local.set(
                            newArrLocal.index,
                            newArrRef,
                        );
                        statementArray.push(setNewArrLocalStmt);
                        const getNewArrLocalStmt = this.module.local.get(
                            newArrLocal.index,
                            newArrLocal.type,
                        );
                        // create a loop to box every element to interface
                        const forLoopIdx =
                            this.wasmCompiler.currentFuncCtx!.i32Local();
                        const for_label = 'for_loop';
                        const for_init = this.module.local.set(
                            forLoopIdx.index,
                            this.module.i32.const(0),
                        );
                        const for_condition = this.module.i32.lt_u(
                            this.module.local.get(
                                forLoopIdx.index,
                                forLoopIdx.type,
                            ),
                            arrLenRef,
                        );
                        const for_incrementor = this.module.local.set(
                            forLoopIdx.index,
                            this.module.i32.add(
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                                this.module.i32.const(1),
                            ),
                        );
                        const for_body = binaryenCAPI._BinaryenArraySet(
                            this.module.ptr,
                            getNewArrLocalStmt,
                            this.module.local.get(
                                forLoopIdx.index,
                                forLoopIdx.type,
                            ),
                            binaryenCAPI._BinaryenArrayGet(
                                this.module.ptr,
                                elemRef,
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                                arrayOriHeapType,
                                false,
                            ),
                        );
                        const flattenLoop: FlattenLoop = {
                            label: for_label,
                            condition: for_condition,
                            statements: for_body,
                            incrementor: for_incrementor,
                        };
                        statementArray.push(for_init);
                        statementArray.push(
                            this.module.loop(
                                for_label,
                                FunctionalFuncs.flattenLoopStatement(
                                    this.module,
                                    flattenLoop,
                                    SemanticsKind.FOR,
                                ),
                            ),
                        );
                        srcArrRefs.push(getNewArrLocalStmt);
                    } else {
                        const arrRef = elemRef;
                        srcArrRefs.push(arrRef);
                    }
                } else if (target.type.kind == ValueTypeKind.ANY) {
                    const anyArrRef = elemRef;
                    const propNameRef = this.getStringOffset('length');
                    // get the length of any array
                    const arrLenLocal =
                        this.wasmCompiler.currentFuncCtx!.i32Local();
                    const setArrLenStmt = this.module.local.set(
                        arrLenLocal.index,
                        this.module.i32.trunc_u.f64(
                            FunctionalFuncs.unboxAnyToBase(
                                this.module,
                                FunctionalFuncs.getDynObjProp(
                                    this.module,
                                    anyArrRef,
                                    propNameRef,
                                ),
                                ValueTypeKind.NUMBER,
                            ),
                        ),
                    );
                    statementArray.push(setArrLenStmt);
                    // create a new array
                    const newArr = binaryenCAPI._BinaryenArrayNew(
                        this.module.ptr,
                        arrayOriHeapType,
                        this.module.local.get(
                            arrLenLocal.index,
                            arrLenLocal.type,
                        ),
                        binaryen.none,
                    );
                    const newArrLocal =
                        this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                            binaryen.getExpressionType(newArr),
                        );
                    const setNewArrLocalStmt = this.module.local.set(
                        newArrLocal.index,
                        newArr,
                    );
                    statementArray.push(setNewArrLocalStmt);
                    // create a loop to set the new array
                    const forLoopIdx =
                        this.wasmCompiler.currentFuncCtx!.i32Local();
                    const for_label = 'for_loop';
                    const for_init = this.module.local.set(
                        forLoopIdx.index,
                        this.module.i32.const(0),
                    );
                    const for_condition = this.module.i32.lt_u(
                        this.module.local.get(
                            forLoopIdx.index,
                            forLoopIdx.type,
                        ),
                        this.module.local.get(
                            arrLenLocal.index,
                            arrLenLocal.type,
                        ),
                    );
                    const for_incrementor = this.module.local.set(
                        forLoopIdx.index,
                        this.module.i32.add(
                            this.module.local.get(
                                forLoopIdx.index,
                                forLoopIdx.type,
                            ),
                            this.module.i32.const(1),
                        ),
                    );
                    let getDynArrElemStmt: binaryenCAPI.ExpressionRef;
                    if (elemType.isPrimitive) {
                        getDynArrElemStmt = FunctionalFuncs.unboxAnyToBase(
                            this.module,
                            FunctionalFuncs.getDynArrElem(
                                this.module,
                                anyArrRef,
                                this.module.local.get(
                                    forLoopIdx.index,
                                    forLoopIdx.type,
                                ),
                            ),
                            elemType.kind,
                        );
                    } else {
                        getDynArrElemStmt = FunctionalFuncs.getDynArrElem(
                            this.module,
                            anyArrRef,
                            this.module.local.get(
                                forLoopIdx.index,
                                forLoopIdx.type,
                            ),
                        );
                    }
                    const for_body = binaryenCAPI._BinaryenArraySet(
                        this.module.ptr,
                        this.module.local.get(
                            newArrLocal.index,
                            newArrLocal.type,
                        ),
                        this.module.local.get(
                            forLoopIdx.index,
                            forLoopIdx.type,
                        ),
                        getDynArrElemStmt,
                    );
                    const flattenLoop: FlattenLoop = {
                        label: for_label,
                        condition: for_condition,
                        statements: for_body,
                        incrementor: for_incrementor,
                    };
                    statementArray.push(for_init);
                    statementArray.push(
                        this.module.loop(
                            for_label,
                            FunctionalFuncs.flattenLoopStatement(
                                this.module,
                                flattenLoop,
                                SemanticsKind.FOR,
                            ),
                        ),
                    );
                    srcArrRefs.push(
                        this.module.local.get(
                            newArrLocal.index,
                            newArrLocal.type,
                        ),
                    );
                } else {
                    throw Error('not implemented');
                }
            } else {
                elemRefs.push(elemRef);
            }
        }
        if (elemRefs.length != 0) {
            const elemArrRef = binaryenCAPI._BinaryenArrayNewFixed(
                this.module.ptr,
                arrayOriHeapType,
                arrayToPtr(elemRefs).ptr,
                elemRefs.length,
            );
            const elemArrLocal = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                binaryen.getExpressionType(elemArrRef),
            );
            const setElemArrLocalStmt = this.module.local.set(
                elemArrLocal.index,
                elemArrRef,
            );
            const getElemArrLocalStmt = this.module.local.get(
                elemArrLocal.index,
                elemArrLocal.type,
            );
            statementArray.push(setElemArrLocalStmt);
            srcArrRefs.push(getElemArrLocalStmt);
            elemRefs = [];
        }
        const resConcatArr = this.wasmArrayConcat(
            srcArrRefs,
            arrayOriHeapType,
            statementArray,
        );
        const newArrLenRef = binaryenCAPI._BinaryenArrayLen(
            this.module.ptr,
            this.module.local.get(
                resConcatArr.local.index,
                resConcatArr.local.type,
            ),
        );
        const arrayStructRef = binaryenCAPI._BinaryenStructNew(
            this.module.ptr,
            arrayToPtr([resConcatArr.ref, newArrLenRef]).ptr,
            2,
            arrayStructHeapType,
        );
        const newArrStructLocal =
            this.wasmCompiler.currentFuncCtx!.insertTmpVar(
                binaryen.getExpressionType(arrayStructRef),
            );
        const setNewArrStructLocal = this.module.local.set(
            newArrStructLocal.index,
            arrayStructRef,
        );
        const getNewArrStructLocal = this.module.local.get(
            newArrStructLocal.index,
            newArrStructLocal.type,
        );
        this.wasmCompiler.currentFuncCtx!.insert(setNewArrStructLocal);
        return getNewArrStructLocal;
    }

    private wasmArrayConcat(
        srcArrRefs: binaryenCAPI.ExpressionRef[],
        arrTypeRef: binaryenCAPI.ExpressionRef,
        statementArray: binaryen.ExpressionRef[],
    ) {
        // 1. compute the total length of new array
        // 1.1 create a tmp stores the length
        const totoal_length = this.wasmCompiler.currentFuncCtx!.i32Local();
        const initTotalLenStmt = this.module.local.set(
            totoal_length.index,
            this.module.i32.const(0),
        );
        statementArray.push(initTotalLenStmt);
        const totoal_length_ref = this.module.local.get(
            totoal_length.index,
            totoal_length.type,
        );
        // 1.2 caculate the total length
        for (let i = 0; i < srcArrRefs.length; ++i) {
            const arrLenRef = binaryenCAPI._BinaryenArrayLen(
                this.module.ptr,
                srcArrRefs[i],
            );
            const stmt = this.module.local.set(
                totoal_length.index,
                this.module.i32.add(totoal_length_ref, arrLenRef),
            );
            statementArray.push(stmt);
        }

        // 2. create a new array
        // 2.1 create a local variable to store the new array
        const newArr = binaryenCAPI._BinaryenArrayNew(
            this.module.ptr,
            arrTypeRef,
            totoal_length_ref,
            binaryen.none,
        );
        const newArrLocal = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
            binaryen.getExpressionType(newArr),
        );
        // 2.2 set the new array
        const initArrStmt = this.module.local.set(newArrLocal.index, newArr);
        statementArray.push(initArrStmt);
        const newArrRef = this.module.local.get(
            newArrLocal.index,
            newArrLocal.type,
        );
        //3. create a local variable to store the num of copied elems
        const copiedNum = this.wasmCompiler.currentFuncCtx!.i32Local();
        const initCopiedNumStmt = this.module.local.set(
            copiedNum.index,
            this.module.i32.const(0),
        );
        statementArray.push(initCopiedNumStmt);
        const copiedNumRef = this.module.local.get(
            copiedNum.index,
            copiedNum.type,
        );
        //4. copy all of the elements to the new array
        for (let i = 0; i < srcArrRefs.length; ++i) {
            const srcArrLenRef = binaryenCAPI._BinaryenArrayLen(
                this.module.ptr,
                srcArrRefs[i],
            );
            const copyStmt = binaryenCAPI._BinaryenArrayCopy(
                this.module.ptr,
                newArrRef,
                copiedNumRef,
                srcArrRefs[i],
                this.module.i32.const(0),
                srcArrLenRef,
            );
            statementArray.push(copyStmt);
            const incCopiedNumStmt = this.module.local.set(
                copiedNum.index,
                this.module.i32.add(copiedNumRef, srcArrLenRef),
            );
            statementArray.push(incCopiedNumStmt);
        }
        statementArray.push(newArrRef);
        return {
            local: newArrLocal,
            ref: this.module.block(null, statementArray),
        };
    }
}
