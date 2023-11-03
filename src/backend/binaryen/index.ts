/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from './glue/binaryen.js';
import { arrayToPtr, emptyStructType } from './glue/transform.js';
import { PredefinedTypeId, Stack } from '../../utils.js';
import {
    importAnyLibAPI,
    importInfcLibAPI,
    generateGlobalContext,
    addItableFunc,
    generateGlobalJSObject,
    generateExtRefTableMaskArr,
    generateDynContext,
} from './lib/env_init.js';
import { WASMTypeGen } from './wasm_type_gen.js';
import { WASMExpressionGen } from './wasm_expr_gen.js';
import { WASMStatementGen } from './wasm_stmt_gen.js';
import {
    initGlobalOffset,
    initDefaultMemory,
    initDefaultTable,
} from './memory.js';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import { Ts2wasmBackend, ParserContext, DataSegmentContext } from '../index.js';
import { Logger } from '../../log.js';
import { callBuiltInAPIs } from './lib/init_builtin_api.js';
import {
    BlockNode,
    CaseClauseNode,
    DefaultClauseNode,
    ForInNode,
    ForNode,
    ForOfNode,
    FunctionOwnKind,
    IfNode,
    ModuleNode,
    SemanticsNode,
    SwitchNode,
    TryNode,
    VarDeclareNode,
    WhileNode,
} from '../../semantics/semantics_nodes.js';
import { BuildModuleNode } from '../../semantics/index.js';
import {
    ClosureContextType,
    ObjectType,
    Primitive,
    ValueType,
    ValueTypeKind,
} from '../../semantics/value_types.js';
import { FunctionDeclareNode } from '../../semantics/semantics_nodes.js';
import {
    FunctionalFuncs,
    ItableFlag,
    META_INDEX_MASK,
    META_FLAG_MASK,
    SourceMapLoc,
    BackendLocalVar,
    UtilFuncs,
} from './utils.js';
import {
    MemberDescription,
    MemberType,
    ObjectDescription,
} from '../../semantics/runtime.js';
import { dyntype } from './lib/dyntype/utils.js';
import { assert } from 'console';
import ts from 'typescript';
import { VarValue } from '../../semantics/value.js';
import { ValidateError } from '../../error.js';
import { getConfig } from '../../../config/config_mgr.js';

export class WASMFunctionContext {
    private binaryenCtx: WASMGen;
    private funcOpcodeArray: Array<binaryen.ExpressionRef>;
    private opcodeArrayStack = new Stack<Array<binaryen.ExpressionRef>>();
    private returnOpcode: binaryen.ExpressionRef;
    private returnIndex = 0;
    private currentFunc: FunctionDeclareNode;
    private varsTypeRef: Array<BackendLocalVar> = [];
    private hasGenerateVarsTypeRefs = false;
    private tmpBackendVars: Array<BackendLocalVar> = [];
    private _sourceMapLocs: SourceMapLoc[] = [];
    public localVarIdxNameMap = new Map<string, number>();

    constructor(binaryenCtx: WASMGen, func: FunctionDeclareNode) {
        this.binaryenCtx = binaryenCtx;
        this.funcOpcodeArray = new Array<binaryen.ExpressionRef>();
        this.opcodeArrayStack.push(this.funcOpcodeArray);
        this.returnOpcode = this.binaryenCtx.module.return();
        this.currentFunc = func;
    }

    i32Local() {
        return this.insertTmpVar(binaryen.i32);
    }

    insert(insn: binaryen.ExpressionRef) {
        this.opcodeArrayStack.peek().push(insn);
    }

    setReturnOpcode(returnOpcode: binaryen.ExpressionRef) {
        this.returnOpcode = returnOpcode;
    }

    get returnOp() {
        return this.returnOpcode;
    }

    get sourceMapLocs() {
        return this._sourceMapLocs;
    }

    enterScope() {
        this.opcodeArrayStack.push(new Array<binaryen.ExpressionRef>());
    }

    exitScope() {
        const topMostArray = this.opcodeArrayStack.pop();
        return topMostArray;
    }

    getBody() {
        return this.funcOpcodeArray;
    }

    get returnIdx() {
        return this.returnIndex;
    }

    insertReturnVar(returnVarType: binaryenCAPI.TypeRef) {
        const returnVarIdx = this.allocateTmpVarIdx();
        this.returnIndex = returnVarIdx;
        const returnVar = {
            index: returnVarIdx,
            type: returnVarType,
        };
        this.tmpBackendVars.push(returnVar);
    }

    insertTmpVar(tmpVarType: binaryenCAPI.TypeRef) {
        const tmpVarIdx = this.allocateTmpVarIdx();
        const tmpVar = {
            index: tmpVarIdx,
            type: tmpVarType,
        };
        this.tmpBackendVars.push(tmpVar);
        return tmpVar;
    }

    private generateFuncVarsTypeRefs(varNode: SemanticsNode) {
        if (varNode instanceof FunctionDeclareNode) {
            /* funtion vars */
            if (varNode.varList) {
                for (const variable of varNode.varList) {
                    const backendVar = {
                        type: this.binaryenCtx.wasmTypeComp.getWASMValueType(
                            variable.type,
                        ),
                        index: variable.index,
                    };
                    this.varsTypeRef.push(backendVar);
                    this.setLocalVarName(variable.name, variable.index);
                }
            }
            this.generateFuncVarsTypeRefs(varNode.body);
        } else if (varNode instanceof BlockNode) {
            /* block vars */
            if (varNode.varList) {
                for (const variable of varNode.varList) {
                    const backendVar = {
                        type: this.binaryenCtx.wasmTypeComp.getWASMValueType(
                            variable.type,
                        ),
                        index: variable.index,
                    };
                    this.varsTypeRef.push(backendVar);
                    this.setLocalVarName(variable.name, variable.index);
                }
            }
            varNode.statements.forEach((s) => {
                this.generateFuncVarsTypeRefs(s);
            });
        } else if (
            varNode instanceof ForNode ||
            varNode instanceof ForInNode ||
            varNode instanceof ForOfNode ||
            varNode instanceof WhileNode ||
            varNode instanceof CaseClauseNode ||
            varNode instanceof DefaultClauseNode ||
            varNode instanceof TryNode
        ) {
            if (varNode.body instanceof BlockNode) {
                this.generateFuncVarsTypeRefs(varNode.body);
            }
            if (varNode instanceof TryNode) {
                if (varNode.catchClause) {
                    this.generateFuncVarsTypeRefs(varNode.catchClause.body);
                }
                if (varNode.finallyBlock) {
                    this.generateFuncVarsTypeRefs(varNode.finallyBlock);
                }
            }
        } else if (varNode instanceof SwitchNode) {
            varNode.caseClause.forEach((c) => {
                this.generateFuncVarsTypeRefs(c);
            });
            if (varNode.defaultClause) {
                this.generateFuncVarsTypeRefs(varNode.defaultClause);
            }
        } else if (varNode instanceof IfNode) {
            if (varNode.trueNode) {
                this.generateFuncVarsTypeRefs(varNode.trueNode);
            }
            if (varNode.falseNode) {
                this.generateFuncVarsTypeRefs(varNode.falseNode);
            }
        }
    }

    getFuncVarsTypeRefs(varNode: SemanticsNode) {
        if (!this.hasGenerateVarsTypeRefs) {
            this.generateFuncVarsTypeRefs(varNode);
            this.hasGenerateVarsTypeRefs = true;
        }
        return this.varsTypeRef;
    }

    allocateTmpVarIdx() {
        const allFuncVarsLen = this.getFuncVarsTypeRefs(
            this.currentFunc,
        ).length;
        const allFuncParamsLen =
            (this.currentFunc.parameters
                ? this.currentFunc.parameters.length
                : 0) + this.currentFunc.funcType.envParamLen;
        return allFuncParamsLen + allFuncVarsLen + this.tmpBackendVars.length;
    }

    getAllFuncVarsTypeRefs() {
        const funcVarsTypeRefs = this.getFuncVarsTypeRefs(this.currentFunc);
        const backendVarsTypeRefs: BackendLocalVar[] = [];
        for (const value of this.tmpBackendVars) {
            backendVarsTypeRefs.push(value);
            this.setLocalVarName('tempVar', value.index);
        }
        return funcVarsTypeRefs.concat(backendVarsTypeRefs);
    }

    setLocalVarName(name: string, index: number) {
        if (this.localVarIdxNameMap.has(name)) {
            this.localVarIdxNameMap.set(`${name}_${index}`, index);
        } else {
            this.localVarIdxNameMap.set(name, index);
        }
    }
}

export class WASMGen extends Ts2wasmBackend {
    private _semanticModule: ModuleNode;
    private _binaryenModule: binaryen.Module;

    private _wasmTypeCompiler;
    private _wasmExprCompiler;
    private _wasmStmtCompiler;

    currentFuncCtx?: WASMFunctionContext;
    dataSegmentContext?: DataSegmentContext;

    public globalInitFuncCtx: WASMFunctionContext;

    private globalInitFuncName = 'global|init|func';
    public globalInitArray: Array<binaryen.ExpressionRef> = [];
    private debugFileIndex = new Map<string, number>();
    /** source map file url */
    private map: string | null = null;
    public generatedFuncNames: Array<string> = [];
    public sourceFileLists: ts.SourceFile[] = [];
    public emptyRef: binaryen.ExpressionRef;

    constructor(parserContext: ParserContext) {
        super(parserContext);
        if (getConfig().debug) {
            binaryen.setDebugInfo(true);
        }
        this.sourceFileLists = parserContext.sourceFileLists;
        this._semanticModule = BuildModuleNode(parserContext);
        this._binaryenModule = new binaryen.Module();
        this._wasmTypeCompiler = new WASMTypeGen(this);
        this._wasmExprCompiler = new WASMExpressionGen(this);
        this._wasmStmtCompiler = new WASMStatementGen(this);
        this.dataSegmentContext = new DataSegmentContext();
        this.globalInitFuncCtx = new WASMFunctionContext(
            this,
            this._semanticModule.globalInitFunc!,
        );
        this.emptyRef = FunctionalFuncs.getEmptyRef(this._binaryenModule);
    }

    get module(): binaryen.Module {
        return this._binaryenModule;
    }

    get wasmTypeComp(): WASMTypeGen {
        return this._wasmTypeCompiler;
    }

    get wasmExprComp(): WASMExpressionGen {
        return this._wasmExprCompiler;
    }

    get semanticModule() {
        return this._semanticModule;
    }

    public hasFuncName(funcName: string) {
        return this.generatedFuncNames.find((elem) => {
            return funcName === elem;
        });
    }

    public codegen(options?: any): void {
        binaryen.setDebugInfo(getConfig().debug);
        this._binaryenModule.setFeatures(binaryen.Features.All);
        this._binaryenModule.autoDrop();
        this.wasmGenerate();

        /* Sometimes binaryen can't generate binary module,
            we dump the module to text and load it back.
           This is just a simple workaround, we need to find out the root cause
        */
        const textModule = this._binaryenModule.emitText();
        this._binaryenModule.dispose();

        try {
            this._binaryenModule = binaryen.parseText(textModule);
        } catch (e) {
            Logger.debug(textModule);
            Logger.debug(e);
            Logger.error(`Generated module is invalid`);
            throw e;
        }
        this._binaryenModule.setFeatures(binaryen.Features.All);
        this._binaryenModule.autoDrop();

        if (getConfig().opt > 0) {
            binaryenCAPI._BinaryenSetOptimizeLevel(getConfig().opt);
            binaryenCAPI._BinaryenSetShrinkLevel(0);
            binaryenCAPI._BinaryenModuleOptimize(this._binaryenModule.ptr);
        }

        const validationResult = this._binaryenModule.validate();
        if (validationResult === 0) {
            Logger.error(`Validation wasm module failed`);
            throw new ValidateError('Failed to validate generated wasm module');
        }
    }

    public emitBinary(options?: any): Uint8Array {
        let res: Uint8Array = this._binaryenModule.emitBinary();
        if (getConfig().sourceMap) {
            const name = `${options.name_prefix}.wasm.map`;
            const binaryInfo = this._binaryenModule.emitBinary(name);
            res = binaryInfo.binary;
            this.map = binaryInfo.sourceMap;
        }
        return res;
    }

    public emitText(options?: any): string {
        if (options?.format === 'Stack-IR') {
            return this._binaryenModule.emitStackIR();
        }
        return this._binaryenModule.emitText();
    }

    public emitSourceMap(name: string): string {
        /** generete source map file */
        if (this.map === null) {
            return '';
        }
        const sourceMapStr = this.map;
        const content = JSON.parse(sourceMapStr);
        content.sourceRoot = `./${name}`;
        const sourceCode: string[] = [];
        for (const sourceFile of this.sourceFileLists) {
            if (this.debugFileIndex.has(sourceFile.fileName)) {
                sourceCode.push(sourceFile.getFullText());
            }
        }
        content.sourcesContent = sourceCode;
        this.map = null;
        return JSON.stringify(content);
    }

    public dispose(): void {
        this._binaryenModule.dispose();
    }

    private wasmGenerate() {
        UtilFuncs.clearWasmStringMap();
        FunctionalFuncs.resetDynContextRef();

        // init wasm environment
        initGlobalOffset(this.module);
        initDefaultTable(this.module);
        /* init builtin APIs */
        callBuiltInAPIs(this.module);
        /* init any lib APIs */
        importAnyLibAPI(this.module);
        this.globalInitFuncCtx.insert(generateDynContext(this.module));
        /* init interface lib APIs */
        importInfcLibAPI(this.module);
        addItableFunc(this.module);

        if (getConfig().enableException) {
            /* add exception tags: anyref */
            this.module.addTag(
                BuiltinNames.errorTag,
                binaryen.anyref,
                binaryen.none,
            );
            this.module.addTag(
                BuiltinNames.finallyTag,
                binaryen.anyref,
                binaryen.none,
            );
        }
        /** parse all recursive types firstly */
        this.wasmTypeComp.parseCircularRecType();
        /* add global vars */
        this.addGlobalVars();

        /* parse functions */
        this.parseFuncs();

        generateGlobalContext(this.module);
        generateExtRefTableMaskArr(this.module);
        BuiltinNames.JSGlobalObjects.forEach((key) => {
            generateGlobalJSObject(this.module, key);
            /* Insert at the second slot (right after dyntype context initialized) */
            this.globalInitFuncCtx.insert(this.genrateInitJSGlobalObject(key));
            BuiltinNames.JSGlobalObjects.delete(key);
        });

        const segments = [];
        const segmentInfo = this.dataSegmentContext!.generateSegment();
        if (segmentInfo) {
            segments.push({
                offset: this.module.i32.const(segmentInfo!.offset),
                data: segmentInfo!.data,
                passive: false,
            });
        }
        initDefaultMemory(this.module, segments);

        this.initEnv();
    }

    private addGlobalVars() {
        /* all global vars will be put into global init function, all mutable */
        const globalVarArray = this._semanticModule.globalVars;
        for (const globalVar of globalVarArray) {
            if (globalVar.name.includes('builtin')) {
                continue;
            }
            this.module.removeGlobal(globalVar.name);
            /* get wasm type */
            const varTypeRef = this.wasmTypeComp.getWASMValueType(
                globalVar.type,
            );
            /* TODO: it seems that isDeclare information not recorded. flag? */
            /* get the default value based on type */
            this.module.addGlobal(
                globalVar.name,
                varTypeRef,
                true,
                FunctionalFuncs.getVarDefaultValue(
                    this.module,
                    globalVar.type.kind,
                ),
            );
        }
    }

    /* parse functions */
    private parseFuncs() {
        const funcArray = this._semanticModule!.functions;
        for (const func of funcArray) {
            this.parseFunc(func);
        }
    }

    public parseFunc(func: FunctionDeclareNode) {
        if (this.hasFuncName(func.name)) {
            return;
        }
        if ((func.ownKind & FunctionOwnKind.DECORATOR) !== 0) {
            /* Function with @binaryen decorator is implemented directly
                using binaryen API, don't generate code for them */
            return;
        }
        /* get function type */
        const tsFuncType = func.funcType;
        const paramWASMTypes =
            this.wasmTypeComp.getWASMFuncParamTypes(tsFuncType);
        const returnType = tsFuncType.returnType;
        const returnWASMType = this.wasmTypeComp.getWASMValueType(returnType);
        const oriParamWasmTypes =
            this.wasmTypeComp.getWASMFuncOriParamTypes(tsFuncType);

        /* generate import function name */
        const levelNames = func.name.split(BuiltinNames.moduleDelimiter);
        let importName = levelNames[levelNames.length - 1];
        if ((func.ownKind & FunctionOwnKind.METHOD) !== 0) {
            importName = `${levelNames[levelNames.length - 2]}_${importName}`;
        }

        /** declare functions */
        if ((func.ownKind & FunctionOwnKind.DECLARE) !== 0) {
            /* Skip the @context and @this */
            const importParamWASMTypes = paramWASMTypes.slice(
                BuiltinNames.envParamLen,
            );
            const internalFuncName = `${func.name}${BuiltinNames.declareSuffix}`;
            this.module.addFunctionImport(
                internalFuncName,
                BuiltinNames.externalModuleName,
                importName,
                binaryen.createType(importParamWASMTypes),
                returnWASMType,
            );
            /* use wrappered func to invoke the orignal func */
            const oriParamWasmValues: binaryen.ExpressionRef[] = [];
            for (let i = 0; i < importParamWASMTypes.length; i++) {
                oriParamWasmValues.push(
                    /* Skip the @context and @this */
                    this.module.local.get(
                        i + BuiltinNames.envParamLen,
                        importParamWASMTypes[i],
                    ),
                );
            }
            let innerOp: binaryen.ExpressionRef;
            const callOp = this.module.call(
                internalFuncName,
                oriParamWasmValues,
                returnWASMType,
            );
            if (returnType.kind !== ValueTypeKind.VOID) {
                innerOp = this.module.return(callOp);
            } else {
                innerOp = callOp;
            }
            this.module.addFunction(
                func.name,
                binaryen.createType(paramWASMTypes),
                returnWASMType,
                [],
                this.module.block(null, [innerOp], returnWASMType),
            );
            if ((func.ownKind & FunctionOwnKind.EXPORT) !== 0) {
                this.module.addFunctionExport(internalFuncName, importName);
            }
            return;
        }

        /* use WASMFunctionContext to record information */
        this.currentFuncCtx = new WASMFunctionContext(this, func);
        /* the calculation of closureContext value is moved to semantic tree and is a statement in body */

        /* assign value for function's context variable */
        if (func.varList && func.varList[0].initCtx) {
            const freeVars: VarDeclareNode[] = [];
            if (func.parameters) {
                for (const p of func.parameters) {
                    if (p.closureIndex !== undefined) {
                        freeVars.push(p);
                    }
                }
            }
            for (const v of func.varList) {
                if (v.closureIndex !== undefined) {
                    freeVars.push(v);
                }
            }
            this.assignCtxVar(func.varList[0], freeVars);
        }

        /* assign value for method's this variable */
        if (
            func.varList &&
            (func.ownKind & FunctionOwnKind.METHOD) !== 0 &&
            (func.ownKind & FunctionOwnKind.STATIC) === 0
        ) {
            this.assignThisVar(func.varList[1]);
        }

        /* add return value iff return type is not void, must ahead of parse return Statement */
        if (returnType.kind !== ValueTypeKind.VOID) {
            this.currentFuncCtx.insertReturnVar(
                this.wasmTypeComp.getWASMValueType(returnType),
            );
        }

        /* for start function, need to call import start funcs */
        if (func.importStartFuncNameList) {
            for (const importStartFuncName of func.importStartFuncNameList) {
                this.currentFuncCtx.insert(
                    this.module.call(importStartFuncName, [], binaryen.none),
                );
            }
        }
        // manually add SUPER() for ctor should before parseBody()
        /** insert SUPER() for class which haven't declare constructor and is sub class*/
        if (
            levelNames[levelNames.length - 1] === 'constructor' &&
            func.varList &&
            !!(func.ownKind & FunctionOwnKind.METHOD) &&
            !(func.ownKind & FunctionOwnKind.STATIC)
        ) {
            const meta = func.thisClassType!.meta;
            const ctor = meta.ctor;
            const base = meta.base;
            const args: binaryen.ExpressionRef[] = [];
            if (ctor && base && base.ctor) {
                const baseClassCtor = base.name.substring(1) + '|constructor';
                if (!ctor.isDeclaredCtor) {
                    args.push(this.emptyRef);
                    args.push(
                        this.module.local.get(
                            func.varList[1].index,
                            emptyStructType.typeRef,
                        ),
                    );
                    if (func.parameters) {
                        for (const arg of func.parameters) {
                            args.push(
                                this.module.local.get(
                                    arg.index,
                                    this.wasmTypeComp.getWASMValueType(
                                        arg.type,
                                    ),
                                ),
                            );
                        }
                    }
                    this.currentFuncCtx.insert(
                        this.module.drop(
                            this.module.call(
                                baseClassCtor,
                                args,
                                binaryen.none,
                            ),
                        ),
                    );
                }
            }
        }
        this.parseBody(func.body);
        this.currentFuncCtx.localVarIdxNameMap.set('@context', 0);
        this.currentFuncCtx.localVarIdxNameMap.set('@this', 1);
        if (func.parameters) {
            for (const p of func.parameters) {
                /** must no duplicate parameter name here */
                this.currentFuncCtx.localVarIdxNameMap.set(p.name, p.index);
            }
        }
        /* get all vars wasm types, must behind the parseBody */
        const backendLocalVars = this.currentFuncCtx.getAllFuncVarsTypeRefs();
        /** sort the local variables array by index */
        backendLocalVars.sort((a, b) => {
            return a.index - b.index;
        });
        const allVarsTypeRefs = backendLocalVars.map((value) => value.type);

        /* For class's constructor, should assign to return idx manually */
        if (
            levelNames[levelNames.length - 1] === 'constructor' &&
            func.varList &&
            (func.ownKind & FunctionOwnKind.METHOD) !== 0 &&
            (func.ownKind & FunctionOwnKind.STATIC) === 0
        ) {
            const thisVar = func.varList[1];
            const thisTypeRef = this.wasmTypeComp.getWASMValueType(
                thisVar.type,
            );
            const getThisVar = this.module.local.get(
                thisVar.index,
                thisTypeRef,
            );
            const assignRef = this.module.local.set(
                this.currentFuncCtx.returnIdx,
                getThisVar,
            );

            this.currentFuncCtx.insert(assignRef);
        }

        const bodyRef = this.module.block(
            'statements',
            this.currentFuncCtx.getBody(),
        );

        /* add return statement */
        if (returnType.kind !== ValueTypeKind.VOID) {
            const returnValue = this.module.local.get(
                this.currentFuncCtx.returnIdx,
                returnWASMType,
            );
            this.currentFuncCtx.setReturnOpcode(
                this.module.return(returnValue),
            );
        }
        if (
            func.isInEnterScope &&
            (func.ownKind & FunctionOwnKind.START) !== 0
        ) {
            /* set enter module start function as wasm start function */
            const startFuncStmts: binaryen.ExpressionRef[] = [];
            /* call globalInitFunc */
            startFuncStmts.push(
                this.module.call(this.globalInitFuncName, [], binaryen.none),
            );
            startFuncStmts.push(this.module.call(func.name, [], binaryen.none));
            this.module.addFunction(
                BuiltinNames.start,
                binaryen.none,
                binaryen.none,
                [],
                this.module.block(null, startFuncStmts),
            );
            this.module.addFunctionExport(
                BuiltinNames.start,
                getConfig().entry,
            );
        }
        let funcRef: binaryen.FunctionRef;
        if (
            func.ownKind & FunctionOwnKind.METHOD &&
            this.wasmTypeComp.heapType.has(func.funcType)
        ) {
            const heap = this.wasmTypeComp.getWASMHeapType(func.funcType);
            funcRef = binaryenCAPI._BinaryenAddFunctionWithHeapType(
                this.module.ptr,
                UtilFuncs.getCString(func.name),
                heap,
                arrayToPtr(allVarsTypeRefs).ptr,
                allVarsTypeRefs.length,
                this.module.block(
                    null,
                    [bodyRef, this.currentFuncCtx.returnOp],
                    returnWASMType,
                ),
            );
        } else {
            funcRef = this.module.addFunction(
                func.name,
                binaryen.createType(paramWASMTypes),
                returnWASMType,
                allVarsTypeRefs,
                this.module.block(
                    null,
                    [bodyRef, this.currentFuncCtx.returnOp],
                    returnWASMType,
                ),
            );
        }
        if (getConfig().debug) {
            this.setDebugLocation(funcRef, func.debugFilePath);
        }
        this.currentFuncCtx.localVarIdxNameMap.clear();

        /** wrapped functions */
        if (
            (func.ownKind &
                (FunctionOwnKind.EXPORT | FunctionOwnKind.DEFAULT)) ===
                (FunctionOwnKind.EXPORT | FunctionOwnKind.DEFAULT) &&
            func.isInEnterScope
        ) {
            const wrapperName = importName.concat(BuiltinNames.wrapperSuffix);
            let idx = 0;
            let oriParamWasmValues: binaryen.ExpressionRef[] = [];
            if (func.parameters) {
                oriParamWasmValues = func.parameters.map((param) => {
                    return this.module.local.get(
                        idx++,
                        this.wasmTypeComp.getWASMValueType(param.type),
                    );
                }) as unknown as binaryen.ExpressionRef[];
            }
            /* add init statements */
            const functionStmts: binaryen.ExpressionRef[] = [];
            /* call globalInitFunc */
            functionStmts.push(
                this.module.call(this.globalInitFuncName, [], binaryen.none),
            );
            const wrapperCallArgs: binaryen.ExpressionRef[] = [];
            for (let i = 0; i < tsFuncType.envParamLen; i++) {
                wrapperCallArgs.push(this.emptyRef);
            }
            const targetCall = this.module.call(
                func.name,
                wrapperCallArgs.concat(oriParamWasmValues),
                returnWASMType,
            );
            const isReturn = returnWASMType === binaryen.none ? false : true;
            functionStmts.push(
                isReturn ? this.module.local.set(idx, targetCall) : targetCall,
            );

            /* set return value */
            const functionVars: binaryen.ExpressionRef[] = [];
            if (isReturn) {
                functionStmts.push(
                    this.module.return(
                        this.module.local.get(idx, returnWASMType),
                    ),
                );
                functionVars.push(returnWASMType);
            }

            this.module.addFunction(
                wrapperName,
                binaryen.createType(oriParamWasmTypes),
                returnWASMType,
                functionVars,
                this.module.block(null, functionStmts),
            );
            this.module.addFunctionExport(wrapperName, importName);
        }

        this.generatedFuncNames.push(func.name);
    }

    public assignCtxVar(context: VarDeclareNode, freeVars: VarDeclareNode[]) {
        const assignedCtxVar = context;
        const assignedCtxTypeRef = this.wasmTypeComp.getWASMHeapType(
            assignedCtxVar.type,
        );
        const initCtxVar = context.initCtx!;
        const initCtxTypeRef = this.wasmTypeComp.getWASMValueType(
            initCtxVar.type,
        );
        const initCtxVarRef = binaryenCAPI._BinaryenRefCast(
            this.module.ptr,
            this.module.local.get(initCtxVar.index, emptyStructType.typeRef),
            initCtxTypeRef,
        );
        let assignRef: binaryen.ExpressionRef;
        /** the function or block generate free variables */
        if (freeVars.length > 0) {
            const freeVarList: binaryen.ExpressionRef[] = [];
            freeVarList.push(initCtxVarRef);
            for (const f of freeVars) {
                let value = this.module.local.get(
                    f.index,
                    this.wasmTypeComp.getWASMValueType(f.type),
                );
                /** if 'this' as free variable */
                if (f.name === 'this') {
                    const type = this.wasmTypeComp.getWASMValueType(f.type);
                    // parameter `this` index
                    const thisParamIndex = 1;
                    value = binaryenCAPI._BinaryenRefCast(
                        this.module.ptr,
                        this.module.local.get(
                            thisParamIndex,
                            emptyStructType.typeRef,
                        ),
                        type,
                    );
                }
                freeVarList.push(value);
            }
            const newCtxStruct = binaryenCAPI._BinaryenStructNew(
                this.module.ptr,
                arrayToPtr(freeVarList).ptr,
                freeVarList.length,
                assignedCtxTypeRef,
            );
            assignRef = this.module.local.set(
                assignedCtxVar.index,
                newCtxStruct,
            );
        } else {
            assignRef = this.module.local.set(
                assignedCtxVar.index,
                initCtxVarRef,
            );
        }
        this.currentFuncCtx!.insert(assignRef);
    }

    public assignThisVar(thisVar: VarDeclareNode) {
        const initedThisVarIdx = 1;
        const assignedThisTypeRef = this.wasmTypeComp.getWASMValueType(
            thisVar.type,
        );
        const initCtxVarRef = binaryenCAPI._BinaryenRefCast(
            this.module.ptr,
            this.module.local.get(initedThisVarIdx, emptyStructType.typeRef),
            assignedThisTypeRef,
        );
        const assignRef = this.module.local.set(thisVar.index, initCtxVarRef);
        this.currentFuncCtx!.insert(assignRef);
    }

    /* parse function body */
    private parseBody(body: BlockNode) {
        /* assign value for block's context variable */
        if (
            body.varList &&
            body.varList[0].type instanceof ClosureContextType &&
            body.varList[0].initCtx
        ) {
            const freeVars: VarDeclareNode[] = [];
            for (const v of body.varList) {
                if (v.closureIndex !== undefined) {
                    freeVars.push(v);
                }
            }
            this.assignCtxVar(body.varList[0], freeVars);
        }
        for (const stmt of body.statements) {
            const stmtRef = this._wasmStmtCompiler.WASMStmtGen(stmt);
            this.currentFuncCtx!.insert(stmtRef);
        }
    }

    private initEnv() {
        const backendLocalVars =
            this.globalInitFuncCtx.getAllFuncVarsTypeRefs();
        /** sort the local variables array by index */
        backendLocalVars.sort((a, b) => {
            return a.index - b.index;
        });
        const allVarsTypeRefs = backendLocalVars.map((value) => value.type);
        this.module.addFunction(
            this.globalInitFuncName,
            binaryen.none,
            binaryen.none,
            allVarsTypeRefs,
            this.module.block(null, this.globalInitFuncCtx.exitScope()),
        );
    }

    public generateRawString(str: string): number {
        const offset = this.dataSegmentContext!.addString(str);
        return offset;
    }

    public generateMetaInfo(objType: ObjectType): number {
        if (this.dataSegmentContext!.metaMap.has(objType.typeId)) {
            return this.dataSegmentContext!.metaMap.get(objType.typeId)!;
        }
        const members = objType.meta.members;
        let dataLength = members.length;
        dataLength += members.filter((m) => m.hasSetter && m.hasGetter).length;
        const buffer = new Uint32Array(3 + 3 * dataLength);
        buffer[0] = objType.typeId;
        buffer[1] = objType.implId;
        buffer[2] = dataLength;
        // if (buffer[1] > (1 << 27) - 1) {
        //     throw new Error('Too many members in object type');
        // }
        let memberMethodsCnt = 1;
        const cnt = Math.min(dataLength, members.length);
        let memberFieldsCnt = 1; // In obj, the first field is vtable.
        for (let i = 0, j = 3; i < cnt; i++, j += 3) {
            const member = members[i];
            const memberName = member.name;
            buffer[j] = this.generateRawString(memberName);
            if (member.type === MemberType.FIELD) {
                const flag = ItableFlag.FIELD;
                const index = memberFieldsCnt++;
                buffer[j + 1] =
                    (flag & META_FLAG_MASK) | ((index << 4) & META_INDEX_MASK);
                buffer[j + 2] = this.getDefinedTypeId(member.valueType);
            } else if (member.type === MemberType.METHOD) {
                const flag = ItableFlag.METHOD;
                const index = memberMethodsCnt++;
                buffer[j + 1] =
                    (flag & META_FLAG_MASK) | ((index << 4) & META_INDEX_MASK);
                buffer[j + 2] = this.getDefinedTypeId(member.valueType);
            } else if (member.type === MemberType.ACCESSOR) {
                if (member.hasGetter) {
                    const flag = ItableFlag.GETTER;
                    const index = memberMethodsCnt++;
                    buffer[j + 1] =
                        (flag & META_FLAG_MASK) |
                        ((index << 4) & META_INDEX_MASK);
                    buffer[j + 2] = this.getDefinedTypeId(
                        (member.getter as VarValue).type,
                    );
                }
                if (member.hasGetter && member.hasSetter) {
                    j += 3;
                    buffer[j] = buffer[j - 3];
                }
                if (member.hasSetter) {
                    const flag = ItableFlag.SETTER;
                    const index = memberMethodsCnt++;
                    buffer[j + 1] =
                        (flag & META_FLAG_MASK) |
                        ((index << 4) & META_INDEX_MASK);
                    buffer[j + 2] = this.getDefinedTypeId(
                        (member.setter as VarValue).type,
                    );
                }
            }
        }
        const offset = this.dataSegmentContext!.addData(
            new Uint8Array(buffer.buffer),
        );
        this.dataSegmentContext!.metaMap.set(objType.typeId, offset);
        return offset;
    }

    private getDefinedTypeId(type: ValueType) {
        switch (type.kind) {
            case ValueTypeKind.UNDEFINED:
            case ValueTypeKind.UNION:
            case ValueTypeKind.ANY: {
                return PredefinedTypeId.ANY;
            }
            case ValueTypeKind.NULL:
                return PredefinedTypeId.NULL;
            case ValueTypeKind.INT:
                return PredefinedTypeId.INT;
            case ValueTypeKind.NUMBER:
                return PredefinedTypeId.NUMBER;
            case ValueTypeKind.BOOLEAN:
                return PredefinedTypeId.BOOLEAN;
            case ValueTypeKind.RAW_STRING:
            case ValueTypeKind.STRING:
                return PredefinedTypeId.STRING;
            case ValueTypeKind.FUNCTION:
                /** TODO: create type id for function type base on signature */
                return PredefinedTypeId.FUNCTION;
            case ValueTypeKind.ARRAY:
                return PredefinedTypeId.ARRAY;
            case ValueTypeKind.INTERFACE:
            case ValueTypeKind.OBJECT: {
                const objType = type as ObjectType;
                return objType.typeId;
            }
            default:
                Logger.warn(
                    `encounter type not assigned type id, type kind is ${type.kind}`,
                );
                return 0;
        }
    }

    public findMethodImplementClass(
        meta: ObjectDescription,
        member: MemberDescription,
    ): ObjectDescription | undefined {
        if (member.isOwn) {
            return meta;
        }

        let curMeta = meta.base;

        while (curMeta) {
            if (curMeta.findMember(member.name)?.isOwn) {
                return curMeta;
            }

            curMeta = curMeta.base;
        }

        return undefined;
    }

    public getMethodMangledName(
        member: MemberDescription,
        meta: ObjectDescription,
        accessorKind?: number /* 0 is getter, 1 is setter */,
    ) {
        const implClassMeta = this.findMethodImplementClass(meta, member);
        assert(implClassMeta, 'implClassMeta should not be undefined');

        let methodName = member.name;
        if (accessorKind !== undefined) {
            if (accessorKind === 0) {
                methodName = 'get_'.concat(member.name);
            } else if (accessorKind === 1) {
                methodName = 'set_'.concat(member.name);
            }
        }
        let implClassName = implClassMeta!.name;
        if (implClassName.includes('@')) {
            implClassName = implClassName.slice(1);
        }
        return UtilFuncs.getFuncName(implClassName, methodName);
    }

    public genrateInitJSGlobalObject(name: string) {
        const namePointer = this.generateRawString(name);
        const JSGlobalObj = this.module.call(
            dyntype.dyntype_get_global,
            [
                this.module.global.get(
                    dyntype.dyntype_context,
                    dyntype.dyn_ctx_t,
                ),
                this.module.i32.const(namePointer),
            ],
            dyntype.dyn_value_t,
        );
        const expr = binaryenCAPI._BinaryenGlobalSet(
            this.module.ptr,
            UtilFuncs.getCString(name),
            JSGlobalObj,
        );
        return expr;
    }

    private setDebugLocation(
        funcRef: binaryen.FunctionRef,
        debugFilePath: string,
    ) {
        const localNameMap = this.currentFuncCtx!.localVarIdxNameMap;
        localNameMap.forEach((idx, name) => {
            binaryenCAPI._BinaryenFunctionSetLocalName(
                funcRef,
                idx,
                UtilFuncs.getCString(name),
            );
        });
        const isBuiltIn = debugFilePath.includes(BuiltinNames.builtinTypeName);
        if (isBuiltIn) {
            return;
        }
        // add debug location
        if (!this.debugFileIndex.has(debugFilePath)) {
            this.debugFileIndex.set(
                debugFilePath,
                this.module.addDebugInfoFileName(debugFilePath),
            );
        }
        const fileIndex = this.debugFileIndex.get(debugFilePath)!;
        /** set source mapping locations*/
        const sourceMap = this.currentFuncCtx!.sourceMapLocs;
        for (let i = 0; i < sourceMap.length; i++) {
            const loc = sourceMap[i];
            this.module.setDebugLocation(
                funcRef,
                loc.ref,
                fileIndex,
                loc.location.line,
                loc.location.character,
            );
        }
    }
}
