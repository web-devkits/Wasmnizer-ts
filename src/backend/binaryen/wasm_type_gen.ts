/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from './glue/binaryen.js';
import {
    arrayToPtr,
    emptyStructType,
    initArrayType,
    initStructType,
    createSignatureTypeRefAndHeapTypeRef,
    Packed,
    generateArrayStructTypeInfo,
    builtinClosureType,
    generateArrayStructTypeForRec,
    ptrToArray,
    baseVtableType,
    baseStructType,
} from './glue/transform.js';
import { assert } from 'console';
import {
    arrayBufferTypeInfo,
    dataViewTypeInfo,
    infcTypeInfo,
    stringTypeInfo,
} from './glue/packType.js';
import { WASMGen } from './index.js';
import {
    ArrayType,
    ClosureContextType,
    EmptyType,
    EnumType,
    FunctionType,
    ObjectType,
    Primitive,
    TupleType,
    TypeParameterType,
    UnionType,
    ValueType,
    ValueTypeKind,
    WASMArrayType,
    WASMStructType,
} from '../../semantics/value_types.js';
import { UnimplementError } from '../../error.js';
import {
    MemberModifier,
    MemberType,
    ObjectDescription,
} from '../../semantics/runtime.js';
import { FunctionalFuncs, UtilFuncs } from './utils.js';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import { VarValue } from '../../semantics/value.js';
import { needSpecialized } from '../../semantics/type_creator.js';
import { getConfig } from '../../../config/config_mgr.js';
import {
    MutabilityKind,
    NullabilityKind,
    PackedTypeKind,
} from '../../utils.js';
import { typeInfo } from './glue/utils.js';

export class WASMTypeGen {
    private typeMap: Map<ValueType, binaryenCAPI.TypeRef> = new Map();
    /** it used for rec types, they share this._tb */
    private _tb: binaryenCAPI.TypeBuilderRef =
        binaryenCAPI._TypeBuilderCreate(1);
    private heapTypeMap: Map<ValueType, binaryenCAPI.HeapTypeRef> = new Map();
    /* For array, we store array's struct type in type map, store array type in oriArrayTypeMap */
    private oriArrayTypeMap: Map<ValueType, binaryenCAPI.TypeRef> = new Map();
    private oriArrayHeapTypeMap: Map<ValueType, binaryenCAPI.HeapTypeRef> =
        new Map();
    /* closure format is : {context: struct{}, funcref: ref $func} */
    private closureStructTypeMap: Map<ValueType, binaryenCAPI.TypeRef> =
        new Map();
    private closureStructHeapTypeMap: Map<ValueType, binaryenCAPI.HeapTypeRef> =
        new Map();
    private funcParamTypesMap: Map<ValueType, binaryenCAPI.TypeRef[]> =
        new Map();
    private funcOriParamTypesMap: Map<ValueType, binaryenCAPI.TypeRef[]> =
        new Map();
    private vtableTypeMap: Map<ValueType, binaryenCAPI.TypeRef> = new Map();
    private vtableHeapTypeMap: Map<ValueType, binaryenCAPI.TypeRef> = new Map();
    private vtableInstMap: Map<ValueType, binaryenCAPI.ExpressionRef> =
        new Map();
    private thisInstMap: Map<ValueType, binaryen.ExpressionRef> = new Map();
    private staticFieldsTypeMap: Map<ValueType, binaryenCAPI.TypeRef> =
        new Map();
    private staticFieldsHeapTypeMap: Map<ValueType, binaryenCAPI.HeapTypeRef> =
        new Map();
    private staticFieldsUpdateMap: Map<ValueType, boolean> = new Map();
    private infcObjTypeMap: Map<ValueType, binaryenCAPI.TypeRef> = new Map();
    private infcObjHeapTypeMap: Map<ValueType, binaryenCAPI.HeapTypeRef> =
        new Map();
    public objTypeMap: Map<string, binaryenCAPI.TypeRef> = new Map();
    private structHeapTypeCnt = 0;
    private arrayHeapTypeCnt = 0;
    private arrayTypeCnt = 0;
    private funcHeapTypeCnt = 0;
    private contextHeapTypeCnt = 0;
    private typeToBuilderIdxMap = new Map<ValueType, number>();
    /** records Type to TypeBuilder index auxiliary */
    private auxTypeIndexMap = new Map<ValueType, number>();
    /** the entry of rec group circle */
    private recStartElem: ObjectType | null = null;

    constructor(private wasmComp: WASMGen) {
        //
    }

    parseCircularRecType(): void {
        /** parsing recursive types firstly */
        const recTypes = this.wasmComp.semanticModule.recObjectTypeGroup;
        for (let i = 0; i < recTypes.length; i++) {
            for (let j = 0; j < recTypes[i].length; j++) {
                this.typeToBuilderIdxMap.set(recTypes[i][j], j);
            }
            if (recTypes[i].length > 1) {
                binaryenCAPI._TypeBuilderGrow(this._tb, recTypes[i].length - 1);
            }
            this.recStartElem = recTypes[i][0];
            this.createWASMObjectType(this.recStartElem);
            this.typeToBuilderIdxMap.clear();
            this.auxTypeIndexMap.clear();
            this.recStartElem = null;
            this._tb = binaryenCAPI._TypeBuilderCreate(1);
        }
    }

    createWASMType(type: ValueType): void {
        switch (type.kind) {
            case ValueTypeKind.VOID:
            case ValueTypeKind.BOOLEAN:
            case ValueTypeKind.NUMBER:
            case ValueTypeKind.STRING:
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.UNDEFINED:
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY:
            case ValueTypeKind.INT:
            case ValueTypeKind.WASM_I64:
            case ValueTypeKind.WASM_F32:
                this.createWASMBaseType(type);
                break;
            case ValueTypeKind.NULL:
            case ValueTypeKind.EMPTY:
                this.createWASMEmptyType(type);
                break;
            case ValueTypeKind.CLOSURECONTEXT:
                this.createWASMContextType(<ClosureContextType>type);
                break;
            case ValueTypeKind.TYPE_PARAMETER:
                this.createWASMSpecializeType(<TypeParameterType>type);
                break;
            case ValueTypeKind.GENERIC:
                this.createWASMGenericType(type);
                break;
            case ValueTypeKind.ARRAY:
                this.createWASMArrayType(<ArrayType>type);
                break;
            case ValueTypeKind.FUNCTION:
                this.createWASMFuncType(<FunctionType>type);
                break;
            case ValueTypeKind.OBJECT:
                this.createWASMObjectType(<ObjectType>type);
                break;
            case ValueTypeKind.ENUM:
                this.createWASMEnumType(<EnumType>type);
                break;
            case ValueTypeKind.TUPLE:
                this.createWASMTupleType(<TupleType>type);
                break;
            case ValueTypeKind.WASM_ARRAY:
            case ValueTypeKind.WASM_STRUCT:
                this.createWASMRawType(type);
                break;
            default:
                throw new UnimplementError(`createWASMType: ${type}`);
        }
    }

    createWASMBaseType(type: ValueType): void {
        if (this.typeMap.has(type)) {
            return;
        }

        switch (type.kind) {
            case ValueTypeKind.VOID:
                this.typeMap.set(type, binaryen.none);
                break;

            case ValueTypeKind.BOOLEAN:
                this.typeMap.set(type, binaryen.i32);
                break;

            case ValueTypeKind.NUMBER:
                this.typeMap.set(type, binaryen.f64);
                break;

            case ValueTypeKind.INT:
                this.typeMap.set(type, binaryen.i32);
                break;

            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING: {
                const stringType = getConfig().enableStringRef
                    ? binaryenCAPI._BinaryenTypeStringref()
                    : stringTypeInfo.typeRef;
                const stringHeapType = getConfig().enableStringRef
                    ? binaryenCAPI._BinaryenHeapTypeString()
                    : stringTypeInfo.heapTypeRef;
                this.typeMap.set(type, stringType);
                this.heapTypeMap.set(type, stringHeapType);
                this.createCustomTypeName(
                    'string_type',
                    stringTypeInfo.heapTypeRef,
                );
                break;
            }
            case ValueTypeKind.UNDEFINED:
            case ValueTypeKind.ANY:
            case ValueTypeKind.UNION:
                this.typeMap.set(type, binaryen.anyref);
                break;
            case ValueTypeKind.WASM_I64:
                this.typeMap.set(type, binaryen.i64);
                break;
            case ValueTypeKind.WASM_F32:
                this.typeMap.set(type, binaryen.f32);
                break;
            default:
                break;
        }
    }

    createWASMEmptyType(type: EmptyType) {
        this.typeMap.set(type, emptyStructType.typeRef);
        this.heapTypeMap.set(type, emptyStructType.heapTypeRef);
    }

    createWASMContextType(type: ClosureContextType) {
        let typeRef: binaryenCAPI.TypeRef;
        let heapTypeRef: binaryenCAPI.HeapTypeRef;

        const parentTypeRef = type.parentCtxType
            ? this.getWASMValueType(type.parentCtxType)
            : emptyStructType.typeRef;
        const parentHeapTypeRef = type.parentCtxType
            ? this.getWASMValueHeapType(type.parentCtxType)
            : emptyStructType.heapTypeRef;

        if (type.freeVarTypeList.length > 0) {
            const contextStructLength = type.freeVarTypeList.length + 1;
            const contextStructTypeRefArray: binaryenCAPI.TypeRef[] = new Array(
                contextStructLength,
            );
            contextStructTypeRefArray[0] = parentTypeRef;
            for (let i = 0; i < type.freeVarTypeList.length; i++) {
                const freeVarTypeRef = this.getWASMValueType(
                    type.freeVarTypeList[i],
                );
                contextStructTypeRefArray[i + 1] = freeVarTypeRef;
            }

            const fieldPackedTypesList: binaryenCAPI.PackedType[] = new Array(
                contextStructLength,
            ).fill(Packed.Not);
            const fieldMutablesList: boolean[] = new Array(
                contextStructLength,
            ).fill(true);
            const contextStructTypeInfo = initStructType(
                contextStructTypeRefArray,
                fieldPackedTypesList,
                fieldMutablesList,
                contextStructLength,
                true,
                -1,
                binaryenCAPI._TypeBuilderCreate(1),
            );
            typeRef = contextStructTypeInfo.typeRef;
            heapTypeRef = contextStructTypeInfo.heapTypeRef;
            this.createCustomTypeName(
                `context${this.contextHeapTypeCnt++}`,
                heapTypeRef,
            );
        } else {
            typeRef = parentTypeRef;
            heapTypeRef = parentHeapTypeRef;
        }

        this.typeMap.set(type, typeRef);
        this.heapTypeMap.set(type, heapTypeRef);
    }

    createWASMFuncType(funcType: FunctionType) {
        const resultWASMType = this.getWASMValueType(funcType.returnType);
        const paramTypes = funcType.argumentsType;
        const paramWASMTypes = new Array<binaryenCAPI.TypeRef>();
        const oriParamWASMTypes = new Array<binaryenCAPI.TypeRef>();
        /* add env params */
        for (let i = 0; i < funcType.envParamLen; ++i) {
            paramWASMTypes.push(emptyStructType.typeRef);
        }
        for (let i = 0; i < paramTypes.length; ++i) {
            const paramTypeRef = this.getWASMValueType(paramTypes[i]);
            paramWASMTypes.push(paramTypeRef);
            oriParamWASMTypes.push(paramTypeRef);
        }

        /* record original param wasm type */
        this.funcParamTypesMap.set(funcType, paramWASMTypes);
        this.funcOriParamTypesMap.set(funcType, oriParamWASMTypes);

        let tb = binaryenCAPI._TypeBuilderCreate(1);
        const buildIndex = this.createTbIndexForType(funcType);

        if (buildIndex !== -1) {
            tb = this._tb;
            const heapType = binaryenCAPI._TypeBuilderGetTempHeapType(
                tb,
                buildIndex,
            );
            const refType = binaryenCAPI._TypeBuilderGetTempRefType(
                tb,
                heapType,
                true,
            );
            this.typeMap.set(funcType, refType);
            this.heapTypeMap.set(funcType, heapType);
        }

        const signature = createSignatureTypeRefAndHeapTypeRef(
            paramWASMTypes,
            resultWASMType,
            buildIndex,
            tb,
        );

        /* create closure type */
        let closureTypeIdx = -1;
        tb = binaryenCAPI._TypeBuilderCreate(1);
        if (buildIndex !== -1) {
            tb = this._tb;
            closureTypeIdx = binaryenCAPI._TypeBuilderGetSize(this._tb);
            binaryenCAPI._TypeBuilderGrow(this._tb, 1);
            this.auxTypeIndexMap.set(funcType, closureTypeIdx);
            const heapType = binaryenCAPI._TypeBuilderGetTempHeapType(
                tb,
                closureTypeIdx,
            );
            const refType = binaryenCAPI._TypeBuilderGetTempRefType(
                tb,
                heapType,
                true,
            );
            this.closureStructTypeMap.set(funcType, refType);
            this.closureStructHeapTypeMap.set(funcType, heapType);
        }

        const closureStructType = initStructType(
            [
                emptyStructType.typeRef,
                emptyStructType.typeRef,
                signature.typeRef,
            ],
            [Packed.Not, Packed.Not, Packed.Not],
            [true, true, false],
            3,
            true,
            closureTypeIdx,
            tb,
            builtinClosureType.heapTypeRef,
        );

        if (buildIndex === -1) {
            this.typeMap.set(funcType, signature.typeRef);
            this.heapTypeMap.set(funcType, signature.heapTypeRef);
            this.closureStructTypeMap.set(funcType, closureStructType.typeRef);
            this.closureStructHeapTypeMap.set(
                funcType,
                closureStructType.heapTypeRef,
            );
            this.createCustomTypeName(
                `function${this.funcHeapTypeCnt}`,
                signature.heapTypeRef,
            );
            this.createCustomTypeName(
                `closure${this.funcHeapTypeCnt++}`,
                closureStructType.heapTypeRef,
            );
        }
    }

    createWASMArrayType(arrayType: ArrayType) {
        /** because array type maybe need to specialized, so the same arrayType may be parsed more than once, and binaryen will generate a new
         * wasm type which doesn't list in rec.
         */
        if (this.getExistWasmArrType(arrayType)) {
            return;
        }

        let tb = binaryenCAPI._TypeBuilderCreate(1);
        const buildIndex = this.createTbIndexForType(arrayType);
        if (buildIndex !== -1) {
            tb = this._tb;
            const heapType = binaryenCAPI._TypeBuilderGetTempHeapType(
                tb,
                buildIndex,
            );
            const refType = binaryenCAPI._TypeBuilderGetTempRefType(
                tb,
                heapType,
                true,
            );
            this.oriArrayTypeMap.set(arrayType, refType);
            this.oriArrayHeapTypeMap.set(arrayType, heapType);
        }

        const elemTypeRef = this.getWASMValueType(arrayType.element);
        const arrayTypeInfo = initArrayType(
            elemTypeRef,
            Packed.Not,
            true,
            true,
            buildIndex,
            tb,
        );

        let arrayStructTypeInfo;
        if (buildIndex !== -1) {
            const idx = binaryenCAPI._TypeBuilderGetSize(this._tb);
            binaryenCAPI._TypeBuilderGrow(this._tb, 1);
            this.auxTypeIndexMap.set(arrayType, idx);

            arrayStructTypeInfo = generateArrayStructTypeForRec(
                arrayTypeInfo,
                idx,
                this._tb,
            );
        } else {
            arrayStructTypeInfo = generateArrayStructTypeInfo(arrayTypeInfo);
            this.oriArrayTypeMap.set(arrayType, arrayTypeInfo.typeRef);
            this.oriArrayHeapTypeMap.set(arrayType, arrayTypeInfo.heapTypeRef);
            this.createCustomTypeName(
                `array-struct${this.arrayHeapTypeCnt++}`,
                arrayStructTypeInfo.heapTypeRef,
            );
            this.createCustomTypeName(
                `array${this.arrayTypeCnt++}`,
                arrayTypeInfo.heapTypeRef,
            );
        }
        this.typeMap.set(arrayType, arrayStructTypeInfo.typeRef);
        this.heapTypeMap.set(arrayType, arrayStructTypeInfo.heapTypeRef);
    }

    createWASMArrayBufferType(type: ObjectType) {
        this.typeMap.set(type, arrayBufferTypeInfo.typeRef);
        this.heapTypeMap.set(type, arrayBufferTypeInfo.heapTypeRef);
    }

    createWASMDataViewType(type: ObjectType) {
        this.typeMap.set(type, dataViewTypeInfo.typeRef);
        this.heapTypeMap.set(type, dataViewTypeInfo.heapTypeRef);
    }

    createWASMBuiltinType(type: ObjectType) {
        const builtinTypeName = type.meta.name;
        switch (builtinTypeName) {
            case BuiltinNames.ARRAYBUFFER: {
                this.createWASMArrayBufferType(type);
                break;
            }
            case BuiltinNames.DATAVIEW: {
                this.createWASMDataViewType(type);
                break;
            }
            default: {
                throw new UnimplementError(
                    `${builtinTypeName} builtin type is not supported`,
                );
            }
        }
    }

    createWASMObjectType(type: ObjectType) {
        const metaInfo = type.meta;
        if (BuiltinNames.builtInObjectTypes.includes(metaInfo.name)) {
            this.createWASMBuiltinType(type);
        } else {
            if (metaInfo.isInterface) {
                this.createWASMInfcType(type);
                this.createWASMClassType(type, true);
            } else {
                if (type.meta.isObjectClass) {
                    this.createStaticFields(type);
                } else {
                    this.createWASMClassType(type);
                }
                if (
                    this.staticFieldsUpdateMap.has(type) &&
                    !this.staticFieldsUpdateMap.get(type)
                ) {
                    this.updateStaticFields(type);
                }
            }
        }
    }

    createWASMInfcType(type: ObjectType) {
        this.typeMap.set(type, infcTypeInfo.typeRef);
        this.heapTypeMap.set(type, infcTypeInfo.heapTypeRef);
    }

    createWASMEnumType(type: EnumType) {
        this.typeMap.set(type, this.getWASMValueType(type.memberType));
    }

    createWASMTupleType(type: TupleType) {
        const fieldTypesListRef = new Array<binaryen.Type>();
        for (const elementType of type.elements) {
            fieldTypesListRef.push(this.getWASMValueType(elementType));
        }
        const fieldPackedTypesListRef = new Array<binaryenCAPI.PackedType>(
            fieldTypesListRef.length,
        ).fill(Packed.Not);
        const fieldMutablesListRef = new Array<boolean>(
            fieldTypesListRef.length,
        ).fill(true);

        const tb = binaryenCAPI._TypeBuilderCreate(1);
        const buildIndex = this.createTbIndexForType(type);
        const tupleTypeInfo = initStructType(
            fieldTypesListRef,
            fieldPackedTypesListRef,
            fieldMutablesListRef,
            fieldTypesListRef.length,
            true,
            buildIndex,
            tb,
        );

        this.typeMap.set(type, tupleTypeInfo.typeRef);
        this.heapTypeMap.set(type, tupleTypeInfo.heapTypeRef);
    }

    createWASMRawType(type: ValueType) {
        if (this.typeMap.has(type)) {
            return;
        }

        switch (type.kind) {
            case ValueTypeKind.WASM_ARRAY:
                this.createWASMArrayRawType(<WASMArrayType>type);
                break;

            case ValueTypeKind.WASM_STRUCT:
                this.createWASMStructRawType(<WASMStructType>type);
                break;

            default:
                break;
        }
    }

    createWASMArrayRawType(type: WASMArrayType) {
        let arrRawTypeRef: binaryen.Type;
        let arrRawHeapTypeRef: binaryenCAPI.HeapTypeRef;
        let arrayRawTypeInfo: typeInfo;
        if (
            type.packedTypeKind === PackedTypeKind.Not_Packed &&
            type.mutability === MutabilityKind.Mutable &&
            type.nullability === NullabilityKind.Nullable
        ) {
            arrRawTypeRef = this.getWASMArrayOriType(type.arrayType);
            arrRawHeapTypeRef = this.getWASMArrayOriHeapType(type.arrayType);
            arrayRawTypeInfo = {
                typeRef: arrRawTypeRef,
                heapTypeRef: arrRawHeapTypeRef,
            };
        } else {
            const elemTypeRef = this.getWASMValueType(type.arrayType.element);
            let elementPackedType: binaryenCAPI.PackedType = Packed.Not;
            switch (type.packedTypeKind) {
                case PackedTypeKind.I8: {
                    elementPackedType = Packed.I8;
                    break;
                }
                case PackedTypeKind.I16: {
                    elementPackedType = Packed.I16;
                    break;
                }
            }
            let elementMutable: binaryenCAPI.bool = true;
            if (type.mutability === MutabilityKind.Immutable) {
                elementMutable = false;
            }
            let nullable: binaryenCAPI.bool = true;
            if (type.nullability === NullabilityKind.NonNullable) {
                nullable = false;
            }
            const tb = binaryenCAPI._TypeBuilderCreate(1);
            const buildIndex = this.createTbIndexForType(type.arrayType);
            arrayRawTypeInfo = initArrayType(
                elemTypeRef,
                elementPackedType,
                elementMutable,
                nullable,
                buildIndex,
                tb,
            );
        }

        this.typeMap.set(type, arrayRawTypeInfo.typeRef);
        this.heapTypeMap.set(type, arrayRawTypeInfo.heapTypeRef);
    }

    createWASMStructRawType(type: WASMStructType) {
        let structRawTypeRef: binaryen.Type;
        let structRawHeapTypeRef: binaryenCAPI.HeapTypeRef;
        let structRawTypeInfo: typeInfo;
        const isEachFieldNotPacked = type.packedTypeKinds.every(
            (value) => value === PackedTypeKind.Not_Packed,
        );
        const isEachFieldMutable = type.mutabilitys.every(
            (value) => value === MutabilityKind.Mutable,
        );
        const isNullable =
            type.nullability === NullabilityKind.Nullable ? true : false;
        if (
            isEachFieldNotPacked &&
            isEachFieldMutable &&
            isNullable &&
            !type.baseType
        ) {
            structRawTypeRef = this.getWASMType(type.tupleType);
            structRawHeapTypeRef = this.getWASMHeapType(type.tupleType);
            structRawTypeInfo = {
                typeRef: structRawTypeRef,
                heapTypeRef: structRawHeapTypeRef,
            };
        } else {
            const fieldTypesListRef = new Array<binaryen.Type>();
            for (const elementType of type.tupleType.elements) {
                fieldTypesListRef.push(this.getWASMValueType(elementType));
            }
            const fieldPackedTypesListRef = new Array<binaryenCAPI.PackedType>(
                fieldTypesListRef.length,
            );
            for (const packedType of type.packedTypeKinds) {
                let fieldPackedType = Packed.Not;
                switch (packedType) {
                    case PackedTypeKind.I8: {
                        fieldPackedType = Packed.I8;
                        break;
                    }
                    case PackedTypeKind.I16: {
                        fieldPackedType = Packed.I16;
                        break;
                    }
                }
                fieldPackedTypesListRef.push(fieldPackedType);
            }
            const fieldMutablesListRef = new Array<boolean>(
                fieldTypesListRef.length,
            );
            for (const mutability of type.mutabilitys) {
                let fieldMutability = true;
                if (mutability === MutabilityKind.Immutable) {
                    fieldMutability = false;
                }
                fieldMutablesListRef.push(fieldMutability);
            }
            let nullable = true;
            if (type.nullability === NullabilityKind.NonNullable) {
                nullable = false;
            }
            const baseTypeRef = type.baseType
                ? this.getWASMType(type.baseType)
                : undefined;

            const tb = binaryenCAPI._TypeBuilderCreate(1);
            const buildIndex = this.createTbIndexForType(type.tupleType);
            structRawTypeInfo = initStructType(
                fieldTypesListRef,
                fieldPackedTypesListRef,
                fieldMutablesListRef,
                fieldTypesListRef.length,
                nullable,
                buildIndex,
                tb,
                baseTypeRef,
            );
        }

        this.typeMap.set(type, structRawTypeInfo.typeRef);
        this.heapTypeMap.set(type, structRawTypeInfo.heapTypeRef);
    }

    getObjSpecialSuffix(type: ArrayType) {
        let specialType: ValueType | undefined = undefined;
        if (type.specialTypeArguments && type.specialTypeArguments.length > 0) {
            /* ArrayType only has one specialTypeArgument */
            specialType = type.specialTypeArguments[0];
        }
        let methodSuffix = '';
        if (specialType) {
            switch (specialType.kind) {
                case ValueTypeKind.NUMBER:
                    methodSuffix = '_f64';
                    break;
                case ValueTypeKind.INT:
                case ValueTypeKind.BOOLEAN:
                    methodSuffix = '_i32';
                    break;
                case ValueTypeKind.WASM_F32:
                    methodSuffix = '_f32';
                    break;
                case ValueTypeKind.WASM_I64:
                    methodSuffix = '_i64';
                    break;
                default:
                    methodSuffix = '_anyref';
            }
        } else {
            methodSuffix = '_anyref';
        }
        return methodSuffix;
    }

    createWASMClassType(type: ObjectType, isInfc = false) {
        const metaInfo = type.meta;
        let tb = binaryenCAPI._TypeBuilderCreate(1);
        const buildIndex = this.createTbIndexForType(type);
        if (buildIndex !== -1) {
            tb = this._tb;
            const heapType = binaryenCAPI._TypeBuilderGetTempHeapType(
                tb,
                buildIndex,
            );
            const refType = binaryenCAPI._TypeBuilderGetTempRefType(
                tb,
                heapType,
                true,
            );
            if (isInfc) {
                this.infcObjTypeMap.set(type, refType);
                this.infcObjHeapTypeMap.set(type, heapType);
            } else {
                this.typeMap.set(type, refType);
                this.heapTypeMap.set(type, heapType);
                this.objTypeMap.set(metaInfo.name, refType);
            }
        }

        /* 1. traverse members */
        /* currently vtable stores all member functions (without constructor) */
        const methodTypeRefs = new Array<binaryenCAPI.TypeRef>();
        methodTypeRefs.push(binaryen.i32);
        const vtableFuncs = new Array<binaryen.ExpressionRef>();
        vtableFuncs.push(
            this.wasmComp.module.i32.const(
                this.wasmComp.generateMetaInfo(type),
            ),
        );
        const fieldTypeRefs = new Array<binaryenCAPI.TypeRef>();
        const fieldMuts = new Array<boolean>();
        const classInitValues = new Array<binaryen.ExpressionRef>();

        this.parseObjectMembers(
            metaInfo,
            methodTypeRefs,
            vtableFuncs,
            fieldTypeRefs,
            fieldMuts,
            classInitValues,
            buildIndex,
        );
        const methodPacked = new Array<binaryenCAPI.PackedType>(
            methodTypeRefs.length,
        ).fill(Packed.Not);
        const methodMuts = new Array<boolean>(methodTypeRefs.length).fill(
            false,
        );

        let baseVtableWasmType: binaryen.Type | undefined;
        let baseWasmType: binaryen.Type | undefined;
        /* 2. generate needed structs */
        /** TODO: Here we only support class extends class or class implement infc,
         * but not support class extends class implement infc, when ref.cast, wasm require declare subtype relationship,
         * So if both have, here we use super class as wasm suptype, that maybe cause error.
         */
        /* vtable type */
        if (type.super) {
            baseVtableWasmType = this.getWASMVtableHeapType(type.super);
            baseWasmType = this.getWASMHeapType(type.super);
        } else if (type.impl) {
            baseVtableWasmType = this.getWASMVtableHeapType(type.impl);
            baseWasmType = this.getWASMObjOriHeapType(type.impl);
        } else {
            baseVtableWasmType = baseVtableType.heapTypeRef;
            baseWasmType = baseStructType.heapTypeRef;
        }

        let vtableIndex = -1;
        let tb1 = binaryenCAPI._TypeBuilderCreate(1);
        if (buildIndex !== -1) {
            /** binaryen doesnt support yet */
            tb1 = this._tb;
            vtableIndex = binaryenCAPI._TypeBuilderGetSize(tb1);
            this.auxTypeIndexMap.set(type, vtableIndex);
            binaryenCAPI._TypeBuilderGrow(tb1, 1);
            const heapType = binaryenCAPI._TypeBuilderGetTempHeapType(
                tb1,
                vtableIndex,
            );
            const refType = binaryenCAPI._TypeBuilderGetTempRefType(
                tb1,
                heapType,
                true,
            );
            this.vtableTypeMap.set(type, refType);
            this.vtableHeapTypeMap.set(type, heapType);
        }

        const vtableType = initStructType(
            methodTypeRefs,
            methodPacked,
            methodMuts,
            methodTypeRefs.length,
            true,
            vtableIndex,
            tb1,
            baseVtableWasmType,
        );
        this.vtableTypeMap.set(type, vtableType.typeRef);
        this.vtableHeapTypeMap.set(type, vtableType.heapTypeRef);
        /* class type */
        fieldTypeRefs.unshift(vtableType.typeRef);
        fieldMuts.unshift(false);
        const fieldPacked = new Array<binaryenCAPI.PackedType>(
            fieldTypeRefs.length,
        ).fill(Packed.Not);

        const wasmClassType = initStructType(
            fieldTypeRefs,
            fieldPacked,
            fieldMuts,
            fieldTypeRefs.length,
            true,
            buildIndex,
            tb,
            baseWasmType,
        );
        if (wasmClassType.heapTypeRef === 0) {
            throw Error(`failed to create class type for ${type.meta.name}`);
        }

        if (buildIndex === -1) {
            this.vtableTypeMap.set(type, vtableType.typeRef);
            this.vtableHeapTypeMap.set(type, vtableType.heapTypeRef);
            if (isInfc) {
                this.infcObjTypeMap.set(type, wasmClassType.typeRef);
                this.infcObjHeapTypeMap.set(type, wasmClassType.heapTypeRef);
            } else {
                /* vtable instance */
                const vtableNameRef = UtilFuncs.getCString(
                    `vt-inst${this.structHeapTypeCnt}`,
                );
                const vtableInstance = this.createVtableInst(
                    vtableNameRef,
                    vtableType.typeRef,
                    vtableType.heapTypeRef,
                    vtableFuncs,
                );
                /* this instance */
                classInitValues.unshift(vtableInstance);
                const thisArg = binaryenCAPI._BinaryenStructNew(
                    this.wasmComp.module.ptr,
                    arrayToPtr(classInitValues).ptr,
                    classInitValues.length,
                    wasmClassType.heapTypeRef,
                );
                this.vtableInstMap.set(type, vtableInstance);
                this.thisInstMap.set(type, thisArg);

                this.typeMap.set(type, wasmClassType.typeRef);
                this.heapTypeMap.set(type, wasmClassType.heapTypeRef);
                this.objTypeMap.set(metaInfo.name, wasmClassType.typeRef);
            }
            this.createCustomTypeName(
                `vt-struct${this.structHeapTypeCnt}`,
                vtableType.heapTypeRef,
            );
            this.createCustomTypeName(
                `cls-struct${this.structHeapTypeCnt++}`,
                wasmClassType.heapTypeRef,
            );
        }

        if (
            buildIndex !== -1 &&
            this.recStartElem &&
            type === this.recStartElem
        ) {
            this.createRecObjectType();
        }
    }

    createWASMSpecializeType(type: TypeParameterType) {
        const specialType = type.specialTypeArgument;
        if (specialType) {
            const specialTypeRef = this.getWASMValueType(specialType);
            this.typeMap.set(type, specialTypeRef);
            if (this.hasHeapType(specialType)) {
                const specialHeapTypeRef =
                    this.getWASMValueHeapType(specialType);
                this.heapTypeMap.set(type, specialHeapTypeRef);
            }
        } else {
            this.typeMap.set(type, binaryen.anyref);
        }
    }

    createWASMGenericType(type: ValueType, typeArg: ValueType | null = null) {
        /* We treat generic as any for most cases, but for some builtin
        methods (e.g. Array.push), we want the generic type to be
        specialized for better performance */
        if (typeArg) {
            const result: binaryenCAPI.TypeRef = this.getWASMValueType(type);
            this.typeMap.set(type, result);
        } else {
            this.typeMap.set(type, binaryen.anyref);
        }
    }

    hasHeapType(type: ValueType): boolean {
        if (
            type.kind === ValueTypeKind.VOID ||
            type.kind === ValueTypeKind.BOOLEAN ||
            type.kind === ValueTypeKind.NUMBER ||
            type.kind === ValueTypeKind.ANY ||
            type.kind === ValueTypeKind.UNDEFINED
        ) {
            return false;
        }
        return true;
    }

    /** return heapTypeMap */
    get heapType() {
        return this.heapTypeMap;
    }

    getWASMType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.typeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.typeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        assert(this.hasHeapType(type), `${type} doesn't have heap type`);
        if (!this.heapTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.heapTypeMap.get(type) as binaryenCAPI.HeapTypeRef;
    }

    getWASMValueType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.typeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        if (type instanceof FunctionType) {
            return this.closureStructTypeMap.get(type) as binaryenCAPI.TypeRef;
        } else {
            return this.typeMap.get(type) as binaryenCAPI.TypeRef;
        }
    }

    getWASMValueHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        if (!this.typeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        if (type instanceof FunctionType) {
            return this.closureStructHeapTypeMap.get(
                type,
            ) as binaryenCAPI.HeapTypeRef;
        } else {
            return this.heapTypeMap.get(type) as binaryenCAPI.HeapTypeRef;
        }
    }

    getWASMFuncParamTypes(type: ValueType): binaryenCAPI.TypeRef[] {
        if (!this.funcParamTypesMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.funcParamTypesMap.get(type)!;
    }

    getWASMFuncOriParamTypes(type: ValueType): binaryenCAPI.TypeRef[] {
        if (!this.funcOriParamTypesMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.funcOriParamTypesMap.get(type)!;
    }

    getWASMArrayOriType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.oriArrayTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }

        return this.oriArrayTypeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMArrayOriHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        if (!this.oriArrayHeapTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.oriArrayHeapTypeMap.get(type) as binaryenCAPI.HeapTypeRef;
    }

    getWASMObjOriType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.infcObjTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMClassType(type as ObjectType, true);
        }
        return this.infcObjTypeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMObjOriHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        if (!this.infcObjHeapTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMClassType(type as ObjectType, true);
        }
        return this.infcObjHeapTypeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMVtableType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.vtableTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.vtableTypeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMVtableHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        if (!this.vtableHeapTypeMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.vtableHeapTypeMap.get(type) as binaryenCAPI.HeapTypeRef;
    }

    getWASMStaticFieldsType(type: ValueType): binaryenCAPI.TypeRef {
        if (!this.staticFieldsTypeMap.has(type)) {
            this.createWASMType(type);
        }
        return this.staticFieldsTypeMap.get(type) as binaryenCAPI.TypeRef;
    }

    getWASMStaticFieldsHeapType(type: ValueType): binaryenCAPI.HeapTypeRef {
        if (!this.staticFieldsHeapTypeMap.has(type)) {
            this.createWASMType(type);
        }
        return this.staticFieldsHeapTypeMap.get(
            type,
        ) as binaryenCAPI.HeapTypeRef;
    }

    getWASMVtableInst(type: ValueType): binaryen.ExpressionRef {
        if (!this.vtableInstMap.has(type) || needSpecialized(type)) {
            this.createWASMObjectType(type as ObjectType);
        }
        return this.vtableInstMap.get(type) as binaryen.ExpressionRef;
    }

    getWASMThisInst(type: ValueType): binaryen.ExpressionRef {
        if (!this.thisInstMap.has(type) || needSpecialized(type)) {
            this.createWASMType(type);
        }
        return this.thisInstMap.get(type) as binaryen.ExpressionRef;
    }

    updateStaticFields(type: ObjectType) {
        const metaInfo = type.meta;
        const name = metaInfo.name + '|static_fields';
        this.wasmComp.globalInitFuncCtx.insert(
            binaryenCAPI._BinaryenGlobalSet(
                this.wasmComp.module.ptr,
                UtilFuncs.getCString(name),
                binaryenCAPI._BinaryenStructNew(
                    this.wasmComp.module.ptr,
                    arrayToPtr([]).ptr,
                    0,
                    this.getWASMStaticFieldsHeapType(type),
                ),
            ),
        );
        let staticFieldIdx = 0;
        const staticFields = binaryenCAPI._BinaryenGlobalGet(
            this.wasmComp.module.ptr,
            UtilFuncs.getCString(name),
            this.getWASMStaticFieldsType(type),
        );
        for (const member of metaInfo.members) {
            if (member.type === MemberType.FIELD && member.isStaic) {
                const initValue = member.staticFieldInitValue!;
                const memberType = member.valueType;
                const valueType = initValue.type;
                /** for Map/Set, it's any type */
                let isInitFallBackType = false;
                if (valueType instanceof ObjectType) {
                    const name = valueType.meta.name;
                    isInitFallBackType =
                        name == BuiltinNames.MAP || name == BuiltinNames.SET;
                }
                let isMemFallBackType = false;
                if (memberType instanceof ObjectType) {
                    const name = memberType.meta.name;
                    isMemFallBackType =
                        name == BuiltinNames.MAP || name == BuiltinNames.SET;
                }
                const curFuncCtx = this.wasmComp.currentFuncCtx;
                this.wasmComp.currentFuncCtx = this.wasmComp.globalInitFuncCtx;
                let wasmInitvalue =
                    this.wasmComp.wasmExprComp.wasmExprGen(initValue);
                this.wasmComp.currentFuncCtx = curFuncCtx;
                if (
                    memberType.kind === ValueTypeKind.ANY &&
                    valueType.kind !== ValueTypeKind.ANY &&
                    !isInitFallBackType
                ) {
                    wasmInitvalue = FunctionalFuncs.boxToAny(
                        this.wasmComp.module,
                        wasmInitvalue,
                        initValue,
                    );
                }
                if (
                    memberType.kind !== ValueTypeKind.ANY &&
                    valueType.kind === ValueTypeKind.ANY &&
                    !isMemFallBackType
                ) {
                    wasmInitvalue = FunctionalFuncs.unboxAny(
                        this.wasmComp.module,
                        wasmInitvalue,
                        valueType.kind,
                        this.getWASMType(valueType),
                    );
                }
                const res = binaryenCAPI._BinaryenStructSet(
                    this.wasmComp.module.ptr,
                    staticFieldIdx,
                    staticFields,
                    wasmInitvalue,
                );
                this.wasmComp.globalInitFuncCtx.insert(res);
                staticFieldIdx++;
            }
        }
        this.staticFieldsUpdateMap.set(type, true);
    }

    private createCustomTypeName(
        name: string,
        heapTypeRef: binaryenCAPI.HeapTypeRef,
    ) {
        binaryenCAPI._BinaryenModuleSetTypeName(
            this.wasmComp.module.ptr,
            heapTypeRef,
            UtilFuncs.getCString(name),
        );
    }

    private createRecObjectType() {
        const size = binaryenCAPI._TypeBuilderGetSize(this._tb);
        binaryenCAPI._TypeBuilderCreateRecGroup(this._tb, 0, size);
        const builtHeapType: binaryenCAPI.HeapTypeRef[] = new Array(size);
        const builtHeapTypePtr = arrayToPtr(builtHeapType);
        const res = binaryenCAPI._TypeBuilderBuildAndDispose(
            this._tb,
            builtHeapTypePtr.ptr,
            0,
            0,
        );
        if (!res) {
            throw new Error('create rec group failed');
        }
        const baseAddr = ptrToArray(builtHeapTypePtr);
        this.typeToBuilderIdxMap.forEach((index, type) => {
            const refType = binaryenCAPI._BinaryenTypeFromHeapType(
                baseAddr[index],
                true,
            );
            const heapType = binaryenCAPI._BinaryenTypeGetHeapType(refType);

            if (type instanceof ArrayType) {
                this.oriArrayTypeMap.set(type, refType);
                this.oriArrayHeapTypeMap.set(type, heapType);
                const structArrIdx = this.auxTypeIndexMap.get(type);
                const structArrRefType = binaryenCAPI._BinaryenTypeFromHeapType(
                    baseAddr[structArrIdx!],
                    true,
                );
                const structArrHeapType =
                    binaryenCAPI._BinaryenTypeGetHeapType(structArrRefType);
                this.typeMap.set(type, structArrRefType);
                this.heapTypeMap.set(type, structArrHeapType);
                this.createCustomTypeName(
                    `array-struct${this.arrayHeapTypeCnt++}`,
                    structArrHeapType,
                );
                this.createCustomTypeName(
                    `array${this.arrayTypeCnt++}`,
                    heapType,
                );
            } else if (type instanceof ObjectType) {
                const vtableIdx = this.auxTypeIndexMap.get(type);
                const vtableRef = binaryenCAPI._BinaryenTypeFromHeapType(
                    baseAddr[vtableIdx!],
                    true,
                );
                const vtableHeapType =
                    binaryenCAPI._BinaryenTypeGetHeapType(vtableRef);
                this.vtableTypeMap.set(type, vtableRef);
                this.vtableHeapTypeMap.set(type, vtableHeapType);
                this.createCustomTypeName(
                    `vt-struct${this.structHeapTypeCnt}`,
                    vtableHeapType,
                );

                if (type.meta.isInterface) {
                    this.infcObjTypeMap.set(type, refType);
                    this.infcObjHeapTypeMap.set(type, heapType);
                } else {
                    this.typeMap.set(type, refType);
                    this.heapTypeMap.set(type, heapType);
                    this.objTypeMap.set(type.meta.name, refType);
                }
                this.createCustomTypeName(
                    `cls-struct${this.structHeapTypeCnt++}`,
                    heapType,
                );
            } else if (type instanceof FunctionType) {
                const closureIndex = this.auxTypeIndexMap.get(type);
                const closureRefType = binaryenCAPI._BinaryenTypeFromHeapType(
                    baseAddr[closureIndex!],
                    true,
                );
                const closureHeapType =
                    binaryenCAPI._BinaryenTypeGetHeapType(closureRefType);
                this.closureStructTypeMap.set(type, closureRefType);
                this.closureStructHeapTypeMap.set(type, closureHeapType);
                this.typeMap.set(type, refType);
                this.heapTypeMap.set(type, heapType);
                this.createCustomTypeName(
                    `function${this.funcHeapTypeCnt}`,
                    heapType,
                );
                this.createCustomTypeName(
                    `closure${this.funcHeapTypeCnt++}`,
                    closureHeapType,
                );
            }
        });

        const builderMap = this.typeToBuilderIdxMap;
        for (const type of builderMap.keys()) {
            /** create function parameter types */
            if (type instanceof FunctionType) {
                const paramTypes = type.argumentsType;
                const paramWASMTypes = new Array<binaryenCAPI.TypeRef>();
                const oriParamWASMTypes = new Array<binaryenCAPI.TypeRef>();
                for (let i = 0; i < type.envParamLen; ++i) {
                    paramWASMTypes.push(emptyStructType.typeRef);
                }
                for (let i = 0; i < paramTypes.length; ++i) {
                    const paramTypeRef = this.getWASMValueType(paramTypes[i]);
                    paramWASMTypes.push(paramTypeRef);
                    oriParamWASMTypes.push(paramTypeRef);
                }
                this.funcParamTypesMap.set(type, paramWASMTypes);
                this.funcOriParamTypesMap.set(type, oriParamWASMTypes);
            } else if (type instanceof ArrayType) {
                //
            } else if (type instanceof ObjectType) {
                const methodTypeRefs = new Array<binaryenCAPI.TypeRef>();
                methodTypeRefs.push(binaryen.i32);
                const vtableFuncs = new Array<binaryen.ExpressionRef>();
                vtableFuncs.push(
                    this.wasmComp.module.i32.const(
                        this.wasmComp.generateMetaInfo(type),
                    ),
                );
                const fieldTypeRefs = new Array<binaryenCAPI.TypeRef>();
                const fieldMuts = new Array<boolean>();
                const classInitValues = new Array<binaryen.ExpressionRef>();

                this.parseObjectMembers(
                    type.meta,
                    methodTypeRefs,
                    vtableFuncs,
                    fieldTypeRefs,
                    fieldMuts,
                    classInitValues,
                    -1,
                );
                /** static fields */
                /* vtable instance */
                const vtableNameRef = UtilFuncs.getCString(
                    `vt-inst${this.structHeapTypeCnt++}`,
                );
                const vtableTypeRef = this.getWASMVtableType(type);
                const vtableHeapType = this.getWASMVtableHeapType(type);
                const vtableInstance = this.createVtableInst(
                    vtableNameRef,
                    vtableTypeRef,
                    vtableHeapType,
                    vtableFuncs,
                );

                /* this instance */
                classInitValues.unshift(vtableInstance);
                const thisArg = binaryenCAPI._BinaryenStructNew(
                    this.wasmComp.module.ptr,
                    arrayToPtr(classInitValues).ptr,
                    classInitValues.length,
                    this.getWASMHeapType(type),
                );
                this.vtableInstMap.set(type, vtableInstance);
                this.thisInstMap.set(type, thisArg);
            }
        }
    }

    private isInRecGroup(type: ValueType) {
        if (type instanceof FunctionType) {
            const params = type.argumentsType;
            for (let i = 0; i < params.length; i++) {
                if (this.isInRecGroup(params[i])) {
                    return true;
                }
            }
            if (this.isInRecGroup(type.returnType)) {
                return true;
            }
        } else if (type instanceof ArrayType) {
            if (this.isInRecGroup(type.element)) {
                return true;
            }
        } else if (type instanceof ObjectType) {
            return this.typeToBuilderIdxMap.has(type);
        }

        return false;
    }

    private createTbIndexForType(type: ValueType) {
        let index = -1;
        if (this.isInRecGroup(type)) {
            if (this.typeToBuilderIdxMap.has(type)) {
                index = this.typeToBuilderIdxMap.get(type)!;
            } else {
                index = binaryenCAPI._TypeBuilderGetSize(this._tb);
                this.typeToBuilderIdxMap.set(type, index);
                binaryenCAPI._TypeBuilderGrow(this._tb, 1);
            }
        }
        return index;
    }

    private getExistWasmArrType(arrayType: ArrayType) {
        for (const alreadyParsedType of this.typeMap.keys()) {
            if (alreadyParsedType instanceof ArrayType) {
                if (alreadyParsedType.toString() === arrayType.toString()) {
                    this.oriArrayTypeMap.set(
                        arrayType,
                        this.oriArrayTypeMap.get(alreadyParsedType)!,
                    );
                    this.oriArrayHeapTypeMap.set(
                        arrayType,
                        this.oriArrayHeapTypeMap.get(alreadyParsedType)!,
                    );
                    this.typeMap.set(
                        arrayType,
                        this.typeMap.get(alreadyParsedType)!,
                    );
                    this.heapTypeMap.set(
                        arrayType,
                        this.heapTypeMap.get(alreadyParsedType)!,
                    );
                    return true;
                }
            }
        }
        return false;
    }

    private parseObjectMembers(
        metaInfo: ObjectDescription,
        methodTypeRefs: binaryenCAPI.TypeRef[],
        vtableFuncs: binaryen.ExpressionRef[],
        fieldTypeRefs: binaryenCAPI.TypeRef[],
        fieldMuts: boolean[],
        classInitValues: binaryen.ExpressionRef[],
        buildIndex: number,
    ) {
        for (const member of metaInfo.members) {
            if (member.type === MemberType.METHOD) {
                let methodMangledName = UtilFuncs.getFuncName(
                    metaInfo.name,
                    member.name,
                );
                if (!metaInfo.isLiteral) {
                    methodMangledName = this.wasmComp.getMethodMangledName(
                        member,
                        metaInfo,
                    );
                    if (
                        BuiltinNames.genericBuiltinMethods.includes(
                            methodMangledName,
                        )
                    ) {
                        continue;
                    }
                }
                const methodTypeRef = this.getWASMType(member.valueType);
                methodTypeRefs.push(methodTypeRef);
                if (buildIndex === -1) {
                    vtableFuncs.push(
                        this.wasmComp.module.ref.func(
                            methodMangledName,
                            methodTypeRef,
                        ),
                    );
                }
            } else if (member.type === MemberType.ACCESSOR) {
                /* Put accessor to vtable, getter first */
                if (member.hasGetter) {
                    let methodMangledName = (member.getter as VarValue)
                        .index as string;
                    if (!metaInfo.isLiteral) {
                        methodMangledName = this.wasmComp.getMethodMangledName(
                            member,
                            metaInfo,
                            0,
                        );
                    }
                    const methodType = this.getWASMType(
                        (member.getter as VarValue).type,
                    );
                    methodTypeRefs.push(methodType);
                    if (buildIndex === -1) {
                        vtableFuncs.push(
                            this.wasmComp.module.ref.func(
                                methodMangledName,
                                methodType,
                            ),
                        );
                    }
                } else {
                    const getterTypeRef = binaryenCAPI._BinaryenTypeFuncref();
                    methodTypeRefs.push(getterTypeRef);
                    if (buildIndex === -1) {
                        vtableFuncs.push(
                            binaryenCAPI._BinaryenRefNull(
                                this.wasmComp.module.ptr,
                                getterTypeRef,
                            ),
                        );
                    }
                }

                if (member.hasSetter) {
                    let methodMangledName = (member.setter as VarValue)
                        .index as string;
                    if (!metaInfo.isLiteral) {
                        methodMangledName = this.wasmComp.getMethodMangledName(
                            member,
                            metaInfo,
                            1,
                        );
                    }
                    const methodType = this.getWASMType(
                        (member.setter as VarValue).type,
                    );
                    methodTypeRefs.push(methodType);
                    if (buildIndex === -1) {
                        vtableFuncs.push(
                            this.wasmComp.module.ref.func(
                                methodMangledName,
                                methodType,
                            ),
                        );
                    }
                } else {
                    const setterTypeRef = binaryenCAPI._BinaryenTypeFuncref();
                    methodTypeRefs.push(setterTypeRef);
                    if (buildIndex === -1) {
                        vtableFuncs.push(
                            binaryenCAPI._BinaryenRefNull(
                                this.wasmComp.module.ptr,
                                setterTypeRef,
                            ),
                        );
                    }
                }
            } else if (member.type === MemberType.FIELD) {
                let defaultValue = FunctionalFuncs.getVarDefaultValue(
                    this.wasmComp.module,
                    member.valueType,
                );
                if (member.valueType.kind === ValueTypeKind.ANY) {
                    defaultValue = FunctionalFuncs.generateDynUndefined(
                        this.wasmComp.module,
                    );
                }
                if (
                    member.valueType instanceof UnionType &&
                    member.valueType.types.has(Primitive.Undefined)
                ) {
                    defaultValue = FunctionalFuncs.generateDynUndefined(
                        this.wasmComp.module,
                    );
                }
                fieldTypeRefs.push(this.getWASMValueType(member.valueType));
                if ((member.modifiers & MemberModifier.READONLY) !== 0) {
                    fieldMuts.push(false);
                } else {
                    fieldMuts.push(true);
                }
                classInitValues.push(defaultValue);
            }
        }
    }

    private createTypeForStaticFields(
        typeRefs: binaryenCAPI.TypeRef[],
        type: ObjectType,
    ) {
        if (typeRefs.length === 0) {
            return;
        }
        const staticPacked = new Array<binaryenCAPI.PackedType>(
            typeRefs.length,
        ).fill(Packed.Not);
        const staticMuts = new Array<boolean>(typeRefs.length).fill(true);
        const staticStructType = initStructType(
            typeRefs,
            staticPacked,
            staticMuts,
            typeRefs.length,
            true,
            -1,
            binaryenCAPI._TypeBuilderCreate(1),
        );
        this.createCustomTypeName(
            `static-struct${this.structHeapTypeCnt++}`,
            staticStructType.heapTypeRef,
        );
        const name = type.meta.name + '|static_fields';
        /** clazz meta */
        binaryenCAPI._BinaryenAddGlobal(
            this.wasmComp.module.ptr,
            UtilFuncs.getCString(name),
            staticStructType.typeRef,
            true,
            this.wasmComp.module.ref.null(
                binaryenCAPI._BinaryenTypeStructref(),
            ),
        );
        this.staticFieldsTypeMap.set(type, staticStructType.typeRef);
        this.staticFieldsHeapTypeMap.set(type, staticStructType.heapTypeRef);
        this.staticFieldsUpdateMap.set(type, false);
    }

    private createStaticFields(type: ObjectType) {
        const staticFieldsTypeRefs = new Array<binaryenCAPI.TypeRef>();
        const metaInfo = type.meta;
        for (const member of metaInfo.members) {
            if (member.type === MemberType.FIELD && member.isStaic) {
                staticFieldsTypeRefs.push(
                    this.getWASMValueType(member.valueType),
                );
            }
        }
        this.createTypeForStaticFields(staticFieldsTypeRefs, type);
    }

    private createVtableInst(
        vtableNameRef: binaryen.ExpressionRef,
        vtableTypeRef: binaryenCAPI.TypeRef,
        vtableHeapType: binaryenCAPI.HeapTypeRef,
        methods: binaryen.ExpressionRef[],
    ) {
        binaryenCAPI._BinaryenAddGlobal(
            this.wasmComp.module.ptr,
            vtableNameRef,
            vtableTypeRef,
            true,
            binaryenCAPI._BinaryenRefNull(
                this.wasmComp.module.ptr,
                vtableTypeRef,
            ),
        );
        const initVtableInst = binaryenCAPI._BinaryenGlobalSet(
            this.wasmComp.module.ptr,
            vtableNameRef,
            binaryenCAPI._BinaryenStructNew(
                this.wasmComp.module.ptr,
                arrayToPtr(methods).ptr,
                methods.length,
                vtableHeapType,
            ),
        );
        this.wasmComp.globalInitFuncCtx.insert(initVtableInst);
        return binaryenCAPI._BinaryenGlobalGet(
            this.wasmComp.module.ptr,
            vtableNameRef,
            vtableTypeRef,
        );
    }
}
