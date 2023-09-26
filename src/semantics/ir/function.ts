/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

import { IRCode, IRBlock } from './ircode.js';

import { IRModule } from './irmodule.js';

import { GlobalContext, S } from './ir_context.js';

import {
    SemanticsKind,
    SemanticsNode,
    FunctionDeclareNode,
    FunctionOwnKind,
    VarDeclareNode,
    BlockNode,
    BasicBlockNode,
    IfNode,
    ForNode,
    ForInNode,
    ForOfNode,
    WhileNode,
    ReturnNode,
} from '../semantics_nodes.js';

import { ObjectType, Primitive } from '../value_types.js';

import {
    SemanticsValue,
    SemanticsValueKind,
    VarValue,
    LiteralValue,
    BinaryExprValue,
    FunctionCallValue,
    ConditionExprValue,
    ElementGetValue,
    ElementSetValue,
    CastValue,
    NewLiteralObjectValue,
    NewConstructorObjectValue,
    NewFromClassObjectValue,
    ShapeGetValue,
    ShapeSetValue,
    ShapeCallValue,
    DynamicGetValue,
    DynamicSetValue,
    DynamicCallValue,
    VTableGetValue,
    VTableSetValue,
    VTableCallValue,
    DirectGetterValue,
    DirectSetterValue,
    DirectCallValue,
    OffsetGetValue,
    OffsetSetValue,
    OffsetGetterValue,
    OffsetSetterValue,
    OffsetCallValue,
    BlockValue,
    BlockBranchValue,
    BlockBranchIfValue,
    FunctionCallBaseValue,
    NewClosureFunction,
    NewArrayLenValue,
    NewArrayValue,
    NewLiteralArrayValue,
    ReturnValue,
} from '../value.js';

import { ObjectDescription, Shape } from '../runtime.js';

import { isEqualOperator } from '../expression_builder.js';

class LocalVars {
    constructor(
        public readonly start: number,
        public readonly vars: VarDeclareNode[],
    ) {}

    findVar(v: VarDeclareNode): number {
        for (let i = 0; i < this.vars.length; i++) {
            const local_var = this.vars[i];
            if (local_var === v || local_var.name == v.name)
                return i + this.start;
        }
        return -1;
    }
}

class Context {
    public maxTempCount = 0;
    public curTempCount = 0;

    private _blockMap = new Map<BlockValue, IRBlock>();
    private _blockStack: IRBlock[] = [];

    private _localVarsStack: LocalVars[] = [];
    private _varCount = 0;

    constructor(
        private _globalContext: GlobalContext,
        public _func: FunctionDeclareNode,
        _irFunc: IRFunction,
    ) {
        this.pushBlock(_irFunc);
        this._varCount =
            (this._func.varList ? this._func.varList.length : 0) +
            (this._func.flattenValue
                ? this.calcLocalVarCount(this._func.flattenValue!)
                : 0);
        this.pushLocalVars(this._func.varList);
    }

    pushLocalVars(varList?: VarDeclareNode[]) {
        if (!varList) return;
        let start = 0;
        if (this._localVarsStack.length > 0) {
            const s = this._localVarsStack[this._localVarsStack.length - 1];
            start = s.start + s.vars.length;
        }

        this._localVarsStack.push(new LocalVars(start, varList!));
    }

    get varCount(): number {
        return this._varCount;
    }

    getLocalVarIndex(value: VarDeclareNode): number {
        for (let i = this._localVarsStack.length - 1; i >= 0; i--) {
            const idx = this._localVarsStack[i].findVar(value);
            if (idx >= 0) return idx;
        }
        return -1;
    }

    getGlobalVarIndex(value: VarDeclareNode, s: S = S.LOAD): number {
        return this._globalContext.getVarIndex(value, s);
    }

    getFunctionIndex(func: FunctionDeclareNode, s: S = S.LOAD): number {
        return this._globalContext.getFunctionIndex(func, s);
    }

    getClassIndex(clazz: ObjectType, s: S = S.NEW): number {
        return this._globalContext.getClassIndex(clazz, s);
    }

    getMetaIndex(meta: ObjectDescription): number {
        return this._globalContext.getMetaIndex(meta);
    }

    getShapeIndex(shape: Shape): number {
        return this._globalContext.getShapeIndex(shape);
    }

    getClosureIndex(var_decl: VarDeclareNode): number {
        return this._func.findClosureIndex(var_decl);
    }

    getParameterIndex(var_decl: VarDeclareNode): number {
        return this._func.findParameterIndex(var_decl);
    }

    addString(s: string): number {
        return this._globalContext.module.dataPool.addString(s);
    }

    private calcLocalVarCount(expr: SemanticsValue): number {
        let count = 0;
        if (expr.kind != SemanticsValueKind.BLOCK) {
            return 0;
        }

        const block = expr as BlockValue;

        if (block.varList) count += block.varList.length;

        let child_count = 0;
        for (const v of block.values) {
            const c = this.calcLocalVarCount(v);
            if (c > child_count) child_count = c;
        }
        return count + child_count;
    }

    reset() {
        this.curTempCount = 0;
    }

    incTemp(n = 1) {
        this.curTempCount += n;
        this.update();
    }
    decTemp(n = 1) {
        this.curTempCount -= n;
    }

    update() {
        if (this.maxTempCount < this.curTempCount)
            this.maxTempCount = this.curTempCount;
    }

    setBlock(block: BlockValue, ir_block: IRBlock) {
        this._blockMap.set(block, ir_block);
    }

    getIRBlock(block: BlockValue): IRBlock | undefined {
        return this._blockMap.get(block);
    }

    topBlock(): IRBlock {
        return this._blockStack[this._blockStack.length - 1];
    }

    pushCode(op: IRCode) {
        this.topBlock().add(op);
    }

    pushBlock(ir_block: IRBlock) {
        this._blockStack.push(ir_block);
    }

    pushBlockVars(block: BlockValue) {
        this.pushLocalVars(block.varList);
    }

    popBlock() {
        this._blockStack.pop();
    }

    popBlockVars(block: BlockValue) {
        if (block.varList) {
            this._localVarsStack.pop();
        }
    }
}

export class IRFunction extends IRBlock {
    public paramCount = 0;
    public varCount = 0;
    public tempCount = 0;
    public closureCount = 0;
    public funcNode: FunctionDeclareNode | undefined;

    constructor(public vm: IRModule) {
        super('function', false);
    }

    get isStartFunction(): boolean {
        return (
            !!this.funcNode && this.funcNode.ownKind == FunctionOwnKind.START
        );
    }

    build(func: FunctionDeclareNode, global: GlobalContext) {
        this.funcNode = func;
        this.paramCount = func.parameters ? func.parameters.length : 0;
        if (func.flattenValue) {
            const context = new Context(global, func, this);
            this.buildValue(func.flattenValue!, context);

            this.tempCount = context.maxTempCount;
            this.varCount = context.varCount;
            this.closureCount = func.closureVars ? func.closureVars.length : 0;
        } else {
            // try to find at module infos
            const info = global.getImportInfo(func);
            if (info) {
                this.add(
                    IRCode.NewImportFunction(
                        info.module.externIndex,
                        info.item.externIndex,
                    ),
                );
            }
        }
    }

    get name(): string {
        return this.funcNode!.name;
    }

    private buildVar(
        var_decl: VarDeclareNode,
        context: Context,
        load: boolean,
    ) {
        let idx = -1;
        let code: IRCode | undefined = undefined;
        if (
            var_decl.storageType == SemanticsValueKind.LOCAL_VAR ||
            var_decl.storageType == SemanticsValueKind.LOCAL_CONST
        ) {
            idx = context.getLocalVarIndex(var_decl);
            if (idx >= 0) {
                if (load) code = IRCode.LoadLocal(idx, var_decl.type);
                else code = IRCode.SaveLocal(idx, var_decl.type);
            }
        } else if (var_decl.storageType == SemanticsValueKind.PARAM_VAR) {
            idx = context.getParameterIndex(var_decl);
            if (idx >= 0) {
                if (load) code = IRCode.LoadParam(idx, var_decl.type);
                else code = IRCode.SaveParam(idx, var_decl.type);
            }
        } else {
            return; // ignroe
        }

        if (!code) {
            idx = context.getClosureIndex(var_decl);
            if (idx >= 0) {
                if (load) code = IRCode.LoadClosure(idx, var_decl.type);
                else code = IRCode.SaveClosure(idx, var_decl.type);
            }
        }

        if (!code) {
            throw Error(
                `buildVar Field, cannot found ${var_decl} in function: ${this.funcNode}`,
            );
        }

        context.pushCode(code!);
    }

    private buildBlockRefList(context: Context, refList?: VarDeclareNode[]) {
        if (!refList) return;
        for (const v of refList!) {
            context.pushCode(IRCode.NewRef(v.type));
            this.buildVar(v, context, false);
        }
    }

    private buildValue(value: SemanticsValue, context: Context) {
        switch (value.kind) {
            case SemanticsValueKind.BLOCK: {
                const block_value = value as BlockValue;
                const op = IRCode.NewBlock(block_value);
                context.pushCode(op);
                context.setBlock(block_value, op.block);
                context.pushBlockVars(block_value);
                context.pushBlock(op.block);
                this.buildBlockRefList(context, block_value.refList);
                for (const v of block_value.values) this.buildValue(v, context);
                context.popBlockVars(block_value);
                context.popBlock();
                break;
            }
            case SemanticsValueKind.BLOCK_BRANCH: {
                const branch = value as BlockBranchValue;
                const ir_target = context.getIRBlock(branch.target);
                if (!ir_target) {
                    throw Error(`IR Need Target`);
                }
                const op = IRCode.NewBranch(ir_target);
                context.pushCode(op);
                break;
            }
            case SemanticsValueKind.BLOCK_BRANCH_IF: {
                const branch = value as BlockBranchIfValue;
                const ir_taget = context.getIRBlock(branch.target.target);
                if (!ir_taget) {
                    throw Error(`IR Need Target`);
                }
                const op = IRCode.NewBranchIf(ir_taget, branch.trueBranch);
                context.decTemp(); // pop the result of stack
                context.pushCode(op);
                break;
            }
            case SemanticsValueKind.THIS:
                context.pushCode(
                    IRCode.LoadThis(this.funcNode!.thisClassType!),
                );
                context.incTemp();
                break;
            case SemanticsValueKind.SUPER:
                context.pushCode(
                    IRCode.LoadThis(this.funcNode!.thisClassType!.super!),
                );
                context.incTemp();
                // TODO
                break;
            case SemanticsValueKind.LITERAL:
                context.pushCode(IRCode.LoadConst(value as LiteralValue));
                context.incTemp();
                break;
            case SemanticsValueKind.PARAM_VAR:
            /* falls through */
            case SemanticsValueKind.CLOSURE_VAR:
            /* falls through */
            case SemanticsValueKind.CLOSURE_CONST:
            /* falls through */
            case SemanticsValueKind.LOCAL_VAR:
            /* falls through */
            case SemanticsValueKind.LOCAL_CONST: {
                const v = value as VarValue;
                if (v.ref instanceof VarDeclareNode) {
                    const var_decl = v.ref as VarDeclareNode;
                    this.buildVar(var_decl, context, true);
                    if (var_decl.isRef())
                        context.pushCode(IRCode.ReadRef(var_decl.type));
                    context.incTemp();
                }
                break;
            }
            case SemanticsValueKind.GLOBAL_VAR:
            /* falls through */
            case SemanticsValueKind.GLOBAL_CONST: {
                const varValue = value as VarValue;
                if (
                    value.kind == SemanticsValueKind.GLOBAL_CONST &&
                    varValue.ref instanceof FunctionDeclareNode
                ) {
                    const func = varValue.ref as FunctionDeclareNode;
                    context.pushCode(
                        IRCode.LoadFunction(
                            context.getFunctionIndex(func, S.LOAD),
                            func.funcType.returnType,
                        ),
                    );
                } else if (varValue.ref instanceof ObjectType) {
                    const obj_type = varValue.ref as ObjectType;
                    if (obj_type.isClassObject()) {
                        // load class
                        context.pushCode(
                            IRCode.LoadClass(
                                context.getClassIndex(
                                    obj_type.instanceType!,
                                    S.LOAD,
                                ),
                                obj_type,
                            ),
                        );
                    }
                } else if (varValue.ref instanceof VarDeclareNode) {
                    const var_decl = varValue.ref as VarDeclareNode;
                    context.pushCode(
                        IRCode.LoadGlobal(
                            context.getGlobalVarIndex(var_decl, S.LOAD),
                            varValue.type,
                        ),
                    );
                    if (var_decl.isRef())
                        context.pushCode(IRCode.ReadRef(var_decl.type));
                } else {
                    throw Error(`unkown var ${varValue}`);
                    break;
                }
                context.incTemp();
                break;
            }

            case SemanticsValueKind.BINARY_EXPR:
                this.buildBinaryExprValue(value as BinaryExprValue, context);
                break;

            /*case SemanticsValueKind.POST_UNARY_EXPR:
         context.pushCode(IRCode.LoadPostUnaryExpr(value as PostUnaryExprValue));
         break;
      case SemanticsValueKind.PRE_UNARY_EXPR:
         context.pushCode(IRCode.LoadPreUnaryExpr(value as PreUnaryExprValue));
         break;*/
            case SemanticsValueKind.FUNCTION_CALL: {
                const func = value as FunctionCallValue;
                this.buildValue(func.func, context);
                context.incTemp();
                if (func.parameters) {
                    for (const p of func.parameters) {
                        this.buildValue(p, context);
                    }
                }
                const param_count = func.parameters
                    ? func.parameters.length
                    : 0;
                context.pushCode(
                    IRCode.NewCall(func.type, param_count, func.typeArguments),
                );
                context.decTemp(param_count);
                break;
            }
            case SemanticsValueKind.CLOSURE_CALL:
                break;

            case SemanticsValueKind.STRING_INDEX_GET:
            /* falls through */
            case SemanticsValueKind.ARRAY_INDEX_GET:
            /* falls through */
            case SemanticsValueKind.OBJECT_INDEX_GET:
            /* falls through */
            case SemanticsValueKind.OBJECT_KEY_GET: {
                const element = value as ElementGetValue;
                this.buildValue(element.index, context);
                this.buildValue(element.owner, context);
                if (value.kind == SemanticsValueKind.STRING_INDEX_GET)
                    context.pushCode(IRCode.NewStringIndexGet());
                else if (value.kind == SemanticsValueKind.ARRAY_INDEX_GET)
                    context.pushCode(IRCode.NewArrayIndexGet(element.type));
                else if (value.kind == SemanticsValueKind.OBJECT_INDEX_GET)
                    context.pushCode(IRCode.NewObjectIndexGet(element.type));
                else context.pushCode(IRCode.NewObjectKeyGet(element.type));
                context.decTemp();
                break;
            }
            case SemanticsValueKind.STRING_INDEX_SET:
            /* falls through */
            case SemanticsValueKind.ARRAY_INDEX_SET:
            /* falls through */
            case SemanticsValueKind.OBJECT_INDEX_SET:
            /* falls through */
            case SemanticsValueKind.OBJECT_KEY_SET: {
                const element = value as ElementSetValue;
                this.buildValue(element.owner, context);
                this.buildValue(element.index, context);
                if (
                    element.opKind &&
                    element.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // a[b] += expr , a.b -= expr ...
                    // load a           [a]
                    // load b           [a,b]
                    // ------
                    // dup  -1          [a,b,a]
                    // dup  -1          [a,b,a,b]
                    // element_get      [a,b, <a.b>]
                    // load expr        [a,b, <a.b>, <expr>]
                    // add              [a,b, <a.b+expr>]
                    // ----------------
                    // element_set      []

                    context.pushCode(
                        IRCode.NewDupStackValue(-1, element.owner.type),
                    );
                    context.pushCode(
                        IRCode.NewDupStackValue(-1, element.index.type),
                    );
                    context.incTemp(2);
                    this.buildValue(element.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(element.opKind!, element.type),
                    );
                } else {
                    // a[b] = expr
                    // load a       [a]
                    // load b       [a,b]
                    // ------
                    // load expr    [a,b, expr]
                    // ------
                    // element_set  []
                    this.buildValue(element.value!, context);
                }

                if (value.kind == SemanticsValueKind.STRING_INDEX_SET)
                    context.pushCode(IRCode.NewStringIndexSet());
                else if (value.kind == SemanticsValueKind.ARRAY_INDEX_SET)
                    context.pushCode(IRCode.NewArrayIndexSet(element.type));
                else if (value.kind == SemanticsValueKind.OBJECT_INDEX_SET)
                    context.pushCode(IRCode.NewObjectIndexSet(element.type));
                else context.pushCode(IRCode.NewObjectKeySet(element.type));
                context.decTemp(2);
                break;
            }
            case SemanticsValueKind.NEW_CONSTRCTOR_OBJECT: {
                const new_object = value as NewConstructorObjectValue;
                const obj_type = new_object.objectType;
                const clazz_idx = context.getClassIndex(obj_type, S.NEW);
                context.pushCode(IRCode.NewObject(clazz_idx, obj_type));
                context.incTemp();
                for (const p of new_object.parameters) {
                    this.buildValue(p, context);
                }
                context.pushCode(
                    IRCode.NewConstructorCall(
                        new_object.type,
                        new_object.parameters.length,
                        new_object.typeArguments,
                    ),
                );
                context.decTemp(new_object.parameters.length);

                break;
            }
            case SemanticsValueKind.NEW_LITERAL_OBJECT: {
                const nlo = value as NewLiteralObjectValue;
                const obj_type = nlo.objectType;
                const meta = obj_type.meta;
                context.pushCode(
                    IRCode.NewObject(
                        context.getClassIndex(obj_type, S.NEW),
                        obj_type,
                    ),
                );
                context.incTemp();
                for (let i = 0; i < nlo.initValues.length; i++) {
                    const f = nlo.initValues[i];
                    const member = meta.members[i];
                    if (f) {
                        // f may be optional, it's would be null
                        context.pushCode(IRCode.NewDupStackValue(0, f.type));
                        this.buildValue(f, context);
                        context.pushCode(
                            IRCode.NewSetOffset(member.index, f.type),
                        );
                    }
                }
                context.decTemp(nlo.initValues.length);
                break;
            }
            case SemanticsValueKind.NEW_FROM_CLASS_OBJECT: {
                const new_obj = value as NewFromClassObjectValue;
                this.buildValue(new_obj.clazz, context);
                context.pushCode(IRCode.NewDynamic(new_obj.type));
                for (let i = 0; i < new_obj.parameters.length; i++) {
                    this.buildValue(new_obj.parameters[i], context);
                }
                context.pushCode(
                    IRCode.NewConstructorCall(
                        new_obj.type,
                        new_obj.parameters.length,
                        new_obj.typeArguments,
                    ),
                );
                context.decTemp(new_obj.parameters.length);
                break;
            }
            case SemanticsValueKind.NEW_LITERAL_ARRAY: {
                const new_literal = value as NewLiteralArrayValue;
                for (let i = 0; i < new_literal.initValues.length; i++) {
                    this.buildValue(new_literal.initValues[i], context);
                }
                context.pushCode(
                    IRCode.NewArrayParameters(
                        new_literal.initValues.length,
                        new_literal.type,
                    ),
                );
                context.decTemp(new_literal.initValues.length - 1);
                break;
            }
            case SemanticsValueKind.NEW_ARRAY: {
                const new_array = value as NewArrayValue;
                for (let i = 0; i < new_array.parameters.length; i++) {
                    this.buildValue(new_array.parameters[i], context);
                }
                context.pushCode(
                    IRCode.NewArrayParameters(
                        new_array.parameters.length,
                        new_array.type,
                    ),
                );
                context.decTemp(new_array.parameters.length - 1);
                break;
            }
            case SemanticsValueKind.NEW_ARRAY_LEN: {
                const new_array_len = value as NewArrayLenValue;
                this.buildValue(new_array_len.len, context);
                context.pushCode(IRCode.NewArrayLength(new_array_len.type));
                context.incTemp();
                break;
            }
            case SemanticsValueKind.NEW_CLOSURE_FUNCTION: {
                const new_closure = value as NewClosureFunction;
                //  new_closure  func_idx
                //  load_val     init0
                //  init_closure_value 0
                //  ...
                const func_idx = context.getFunctionIndex(
                    new_closure.funcNode,
                    S.NEW,
                );
                context.pushCode(IRCode.NewClosure(func_idx, new_closure.type));
                context.incTemp();
                if (new_closure.closureInitList) {
                    const init_list = new_closure.closureInitList!;
                    for (let i = 0; i < init_list.length; i++) {
                        this.buildVar(
                            init_list[i].ref as VarDeclareNode,
                            context,
                            true,
                        );
                        context.pushCode(
                            IRCode.InitClosureValue(i, init_list[i].type),
                        );
                    }
                }
                break;
            }
            case SemanticsValueKind.VALUE_CAST_VALUE:
            /* falls through */
            case SemanticsValueKind.ANY_CAST_VALUE:
            /* falls through */
            case SemanticsValueKind.VALUE_CAST_ANY: {
                const cv = value as CastValue;
                this.buildValue(cv.value, context);
                //context.pushCode(IRCode.NewValueCast(cv));
                break;
            }
            case SemanticsValueKind.ANY_CAST_OBJECT:
            /* falls through */
            case SemanticsValueKind.OBJECT_CAST_ANY: {
                const cv = value as CastValue;
                this.buildValue(cv.value, context);
                // TODO
                //context.pushCode(IRCode.NewValueCast(cv));
                break;
            }
            case SemanticsValueKind.OBJECT_CAST_OBJECT: {
                const cast_value = value as CastValue;
                this.buildValue(cast_value.value, context);
                if (cast_value.shape) {
                    const shape_idx = context.getShapeIndex(cast_value.shape);
                    context.pushCode(
                        IRCode.NewBindShape(shape_idx, cast_value.type),
                    );
                } else {
                    const obj_type = cast_value.type as ObjectType;
                    const meta_idx = context.getMetaIndex(obj_type.meta);
                    context.pushCode(IRCode.NewBuildShape(meta_idx, obj_type));
                }
                context.incTemp();
                break;
            }
            case SemanticsValueKind.DIRECT_GETTER: {
                /*
                   sp[0] = this
                   sp[-1] = func
               */
                const direct_get = value as DirectGetterValue;
                const getter = direct_get.getter as VarValue;
                if (!(getter.ref instanceof FunctionDeclareNode)) {
                    throw Error(`DirectGetter should has a function ${getter}`);
                }
                const func = getter.ref as FunctionDeclareNode;
                const func_idx = context.getFunctionIndex(func, S.CALL);
                // func
                context.pushCode(
                    IRCode.LoadFunction(func_idx, direct_get.type),
                );
                context.incTemp();
                // this
                this.buildValue(direct_get.owner, context);
                // call
                context.pushCode(IRCode.NewMethodCall(direct_get.type, 0));
                context.decTemp(); // pop this, func, push result
                break;
            }
            case SemanticsValueKind.DIRECT_SETTER: {
                /*
                   sp[0] =  value
                   sp[-1] = this
                   sp[-2] = func
               */
                const direct_set = value as DirectSetterValue;
                const setter = direct_set.setter as VarValue;
                if (!(setter.ref instanceof FunctionDeclareNode)) {
                    throw Error(`DirectGetter should has a function ${setter}`);
                }
                // load_function setter
                const func = setter.ref as FunctionDeclareNode;
                const func_idx = context.getFunctionIndex(func, S.CALL);
                // func
                context.pushCode(
                    IRCode.LoadFunction(func_idx, direct_set.type),
                );
                context.incTemp();
                // push this
                this.buildValue(direct_set.owner, context);
                if (
                    direct_set.opKind &&
                    direct_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // a.b += value
                    // load_function getter
                    // dup this
                    // call getter
                    // push value
                    // add
                    const getter = direct_set.getter;
                    if (!getter || !(getter instanceof VarValue)) {
                        throw Error(
                            `DirectSetter ${
                                ts.SyntaxKind[direct_set.opKind]
                            } need a getter`,
                        );
                    }
                    const ref = (getter as VarValue).ref;
                    if (!(ref instanceof FunctionDeclareNode)) {
                        throw Error(
                            `DirectSetter need function getter ${getter}`,
                        );
                    }
                    const func = ref as FunctionDeclareNode;
                    const getter_idx = context.getFunctionIndex(func, S.CALL);
                    context.pushCode(
                        IRCode.LoadFunction(getter_idx, direct_set.type),
                    );
                    context.pushCode(
                        IRCode.NewDupStackValue(-1, direct_set.owner.type),
                    );
                    // call getter
                    context.pushCode(IRCode.NewMethodCall(direct_set.type, 0));
                    context.incTemp();
                    this.buildValue(direct_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(direct_set.opKind!, direct_set.type),
                    );
                } else {
                    // push value
                    this.buildValue(direct_set.value!, context);
                }
                // call
                context.pushCode(IRCode.NewMethodCall(Primitive.Void, 0));
                context.decTemp(3);
                break;
            }
            case SemanticsValueKind.DIRECT_CALL: {
                const direct_call = value as DirectCallValue;
                const method = direct_call.method as VarValue;
                if (!(method.ref instanceof FunctionDeclareNode)) {
                    throw Error(`Cannot find the function ${method}`);
                }
                const func = method.ref as FunctionDeclareNode;
                const func_idx = context.getFunctionIndex(func, S.CALL);
                context.pushCode(
                    IRCode.LoadFunction(func_idx, func.funcType.returnType),
                );
                context.incTemp();
                this.buildValue(direct_call.owner, context);
                this.buildMethodCall(direct_call, context);
                break;
            }
            case SemanticsValueKind.OFFSET_GET: {
                const offset_get = value as OffsetGetValue;
                this.buildValue(offset_get.owner, context);
                context.pushCode(
                    IRCode.NewGetOffset(offset_get.index, offset_get.type),
                );
                break;
            }
            case SemanticsValueKind.OFFSET_GETTER: {
                const offset_get = value as OffsetGetterValue;
                this.buildValue(offset_get.owner, context);
                context.pushCode(
                    IRCode.NewDupStackValue(0, offset_get.owner.type),
                );
                context.incTemp();
                // get the function
                context.pushCode(
                    IRCode.NewGetOffset(offset_get.index, offset_get.type),
                );
                context.pushCode(IRCode.NewSwap());
                // call
                context.pushCode(IRCode.NewMethodCall(offset_get.type, 0));
                context.decTemp();
                break;
            }
            case SemanticsValueKind.OFFSET_SET: {
                const offset_set = value as OffsetSetValue;
                // push owner
                this.buildValue(offset_set.owner, context);
                if (
                    offset_set.opKind &&
                    offset_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // dup  0
                    // get_offset index
                    // push value
                    // op
                    context.pushCode(
                        IRCode.NewDupStackValue(0, offset_set.owner.type),
                    );
                    context.pushCode(
                        IRCode.NewGetOffset(offset_set.index, offset_set.type),
                    );
                    context.incTemp();
                    this.buildValue(offset_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(offset_set.opKind, offset_set.type),
                    );
                } else {
                    // push value
                    this.buildValue(offset_set.value!, context);
                }
                // get_offset index
                context.pushCode(
                    IRCode.NewSetOffset(offset_set.index, offset_set.type),
                );
                context.decTemp(2);
                break;
            }
            case SemanticsValueKind.OFFSET_SETTER: {
                const offset_set = value as OffsetSetterValue;
                // push this
                this.buildValue(offset_set.owner, context);
                // dup 0
                context.pushCode(
                    IRCode.NewDupStackValue(0, offset_set.owner.type),
                );
                context.incTemp();
                // get_offset index
                context.pushCode(
                    IRCode.NewGetOffset(offset_set.index, offset_set.type),
                );
                // swap this/setter
                context.pushCode(IRCode.NewSwap());
                // sp[0] = this
                // sp[-1] = setter

                context.incTemp(2);
                if (
                    offset_set.opKind &&
                    offset_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    if (!offset_set.getterIndex) {
                        throw Error(
                            `OffsetSetterValue's getterIndex is null ${offset_set}`,
                        );
                    }
                    // dup this
                    // get_offset getterIndex
                    // dup this
                    // method_call  0
                    // push value
                    // op
                    context.pushCode(
                        IRCode.NewDupStackValue(0, offset_set.owner.type),
                    );
                    context.pushCode(
                        // TODO create function type
                        IRCode.NewGetOffset(
                            offset_set.getterIndex!,
                            offset_set.type,
                        ),
                    );
                    context.pushCode(
                        IRCode.NewDupStackValue(-1, offset_set.owner.type),
                    );
                    context.pushCode(IRCode.NewMethodCall(offset_set.type, 0));
                    context.incTemp();
                    this.buildValue(offset_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(offset_set.opKind!, offset_set.type),
                    );
                } else {
                    // push value
                    this.buildValue(offset_set.value!, context);
                }
                // call setter(this, value)
                context.pushCode(IRCode.NewMethodCall(offset_set.type, 1));
                context.decTemp(3);
                break;
            }
            case SemanticsValueKind.OFFSET_CALL: {
                const offset_call = value as OffsetCallValue;
                // push this
                this.buildValue(offset_call.owner, context);
                // dup 0
                context.pushCode(
                    IRCode.NewDupStackValue(0, offset_call.owner.type),
                );
                context.incTemp();
                // get method
                context.pushCode(
                    IRCode.NewGetOffset(
                        offset_call.index,
                        offset_call.funcType,
                    ),
                );
                // swap this/method
                context.pushCode(IRCode.NewSwap());
                this.buildMethodCall(offset_call, context);
                break;
            }
            case SemanticsValueKind.VTABLE_GET: {
                const vtable_get = value as VTableGetValue;
                // get this
                this.buildValue(vtable_get.owner, context);
                context.pushCode(
                    IRCode.NewGetVTable(vtable_get.index, vtable_get.type),
                );
                break;
            }
            case SemanticsValueKind.VTABLE_SET: {
                const vtable_set = value as VTableSetValue;
                // get this
                this.buildValue(vtable_set.owner, context);
                if (
                    vtable_set.opKind &&
                    vtable_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // dup this
                    // vtable_get index
                    // push value
                    // op
                    context.pushCode(
                        IRCode.NewDupStackValue(0, vtable_set.owner.type),
                    );
                    context.pushCode(
                        IRCode.NewGetVTable(vtable_set.index, vtable_set.type),
                    );
                    context.incTemp();
                    this.buildValue(vtable_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(vtable_set.opKind!, vtable_set.type),
                    );
                } else {
                    // get value
                    this.buildValue(vtable_set.value!, context);
                }
                context.pushCode(
                    IRCode.NewSetVTable(vtable_set.index, vtable_set.type),
                );
                context.decTemp();
                break;
            }
            case SemanticsValueKind.VTABLE_CALL: {
                const vtable_call = value as VTableCallValue;
                // get this
                this.buildValue(vtable_call.owner, context);
                const params = vtable_call.parameters;
                let param_count = 0;
                if (params) {
                    for (const p of params) this.buildValue(p, context);
                    param_count = params.length;
                }
                context.pushCode(
                    IRCode.NewVTableCall(
                        vtable_call.index,
                        param_count,
                        vtable_call.type,
                    ),
                );
                context.decTemp(param_count);
                break;
            }
            case SemanticsValueKind.SHAPE_GET: {
                const shape_get = value as ShapeGetValue;
                // get this
                this.buildValue(shape_get.owner, context);
                context.pushCode(
                    IRCode.NewGetShape(shape_get.index, shape_get.type),
                );
                break;
            }
            case SemanticsValueKind.SHAPE_SET: {
                const shape_set = value as ShapeSetValue;
                // get this
                this.buildValue(shape_set.owner, context);
                if (
                    shape_set.opKind &&
                    shape_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // dup this
                    // shape_get index
                    // push value
                    // op
                    context.pushCode(
                        IRCode.NewDupStackValue(0, shape_set.owner.type),
                    );
                    context.pushCode(
                        IRCode.NewGetShape(shape_set.index, shape_set.type),
                    );
                    context.incTemp();
                    this.buildValue(shape_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(shape_set.opKind!, shape_set.type),
                    );
                } else {
                    // get value
                    this.buildValue(shape_set.value!, context);
                }
                context.pushCode(
                    IRCode.NewSetShape(shape_set.index, shape_set.type),
                );
                context.decTemp();
                break;
            }
            case SemanticsValueKind.SHAPE_CALL: {
                const shape_call = value as ShapeCallValue;
                // get this
                this.buildValue(shape_call.owner, context);
                const params = shape_call.parameters;
                let param_count = 0;
                if (params) {
                    for (const p of params) this.buildValue(p, context);
                    param_count = params.length;
                }
                context.pushCode(
                    IRCode.NewShapeCall(
                        shape_call.index,
                        param_count,
                        shape_call.type,
                    ),
                );
                context.decTemp(param_count);
                break;
            }
            case SemanticsValueKind.DYNAMIC_GET: {
                const dyn_get = value as DynamicGetValue;
                this.buildValue(dyn_get.owner, context);
                const name_offset = context.addString(dyn_get.name);
                context.pushCode(IRCode.NewGetDynamic(name_offset));
                break;
            }
            case SemanticsValueKind.DYNAMIC_SET: {
                const dyn_set = value as DynamicSetValue;
                this.buildValue(dyn_set.owner, context);
                const name_offset = context.addString(dyn_set.name);
                if (
                    dyn_set.opKind &&
                    dyn_set.opKind != ts.SyntaxKind.EqualsToken
                ) {
                    // dup  owner
                    // get_dynamic name_offset
                    // push value
                    // op
                    context.pushCode(
                        IRCode.NewDupStackValue(0, dyn_set.owner.type),
                    );
                    context.pushCode(IRCode.NewGetDynamic(name_offset));
                    context.incTemp();
                    this.buildValue(dyn_set.value!, context);
                    context.pushCode(
                        IRCode.NewBinaryOp(dyn_set.opKind!, Primitive.Any),
                    );
                } else {
                    this.buildValue(dyn_set.value!, context);
                }
                context.pushCode(IRCode.NewSetDynamic(name_offset));
                break;
            }
            case SemanticsValueKind.DYNAMIC_CALL: {
                const dyn_call = value as DynamicCallValue;
                this.buildValue(dyn_call.owner, context);
                const name_offset = context.addString(dyn_call.name);
                const params = dyn_call.parameters;
                let param_count = 0;
                if (params) {
                    for (const p of params) this.buildValue(p, context);
                    param_count = params.length;
                }
                context.pushCode(
                    IRCode.NewDynamicCall(name_offset, param_count),
                );
                context.decTemp(param_count);

                break;
            }
            case SemanticsValueKind.RET: {
                const ret_value = value as ReturnValue;
                if (ret_value.expr) {
                    this.buildValue(ret_value.expr, context);
                }
                context.pushCode(
                    IRCode.NewReturn(
                        ret_value.expr ? ret_value.expr!.type : undefined,
                    ),
                );
                break;
            }
        }
    }

    private buildMethodCall(func: FunctionCallBaseValue, context: Context) {
        let param_count = 0;
        const parameters = func.parameters;
        if (parameters) {
            for (const p of parameters) this.buildValue(p, context);
            param_count = parameters.length;
        }
        context.pushCode(
            IRCode.NewMethodCall(
                func.funcType.returnType,
                param_count,
                func.typeArguments,
            ),
        );
        context.decTemp(param_count + 1); // params this, func, push result
    }

    private buildSaveVar(v: VarValue, context: Context) {
        if (!(v.ref instanceof VarDeclareNode))
            throw Error(`${v} must be a var`);
        const var_decl = v.ref as VarDeclareNode;
        switch (v.kind) {
            case SemanticsValueKind.LOCAL_CONST: // TODO
            /* falls through */
            case SemanticsValueKind.LOCAL_VAR:
            /* falls through */
            case SemanticsValueKind.PARAM_VAR:
            /* falls through */
            case SemanticsValueKind.CLOSURE_CONST:
            /* falls through */
            case SemanticsValueKind.CLOSURE_VAR:
                if (var_decl.isRef()) {
                    this.buildVar(var_decl, context, true);
                    context.pushCode(IRCode.WriteRef(var_decl.type));
                } else {
                    this.buildVar(var_decl, context, false);
                }
                break;
            case SemanticsValueKind.GLOBAL_CONST: // TODO
            /* falls through */
            case SemanticsValueKind.GLOBAL_VAR:
                if (var_decl.isRef()) {
                    context.pushCode(
                        IRCode.LoadGlobal(
                            context.getGlobalVarIndex(var_decl, S.LOAD),
                            v.type,
                        ),
                    );
                    context.pushCode(IRCode.WriteRef(var_decl.type));
                } else {
                    context.pushCode(
                        IRCode.SaveGlobal(
                            context.getGlobalVarIndex(var_decl, S.SAVE),
                            v.type,
                        ),
                    );
                }
                break;
            default:
                throw Error(`var ${v} cannot be saved`);
        }
        context.decTemp();
    }

    private buildBinaryExprValue(bv: BinaryExprValue, context: Context) {
        if (bv.opKind == ts.SyntaxKind.EqualsToken) {
            this.buildValue(bv.right, context);
            if (bv.left instanceof VarValue) {
                this.buildSaveVar(bv.left as VarValue, context);
            } else {
                throw Error(`error unkown binary express left ${bv.left}`);
            }
            return; // don't check isEqualOperator
        } else if (isEqualOperator(bv.opKind)) {
            //   a += b
            //   sp[0] = b
            //   sp[-1] = a
            //
            if (bv.left instanceof VarValue) {
                this.buildValue(bv.left, context);
                this.buildValue(bv.right, context);
                context.pushCode(IRCode.NewBinaryOp(bv.opKind, bv.type));
                context.decTemp();
                this.buildSaveVar(bv.left as VarValue, context);
            } else {
                throw Error(
                    `error unkown binary express left ${bv.left} in binary ${bv}`,
                );
            }
        } else {
            //   a + b
            //   sp[0] = b
            //   sp[-1] = a
            this.buildValue(bv.left, context);
            this.buildValue(bv.right, context);
            context.pushCode(IRCode.NewBinaryOp(bv.opKind, bv.type));
            context.decTemp(); // pop the top[0], top[-1];
        }
    }

    private pushValue(opcode: IRCode) {
        this.codes.push(opcode);
    }
}
