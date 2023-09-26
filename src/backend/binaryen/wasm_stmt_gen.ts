/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import binaryen from 'binaryen';
import * as binaryenCAPI from './glue/binaryen.js';
import { FlattenLoop, FunctionalFuncs } from './utils.js';
import { WASMGen } from './index.js';
import {
    BasicBlockNode,
    BlockNode,
    BreakNode,
    CaseClauseNode,
    DefaultClauseNode,
    ForNode,
    IfNode,
    ReturnNode,
    SemanticsKind,
    SemanticsNode,
    SwitchNode,
    ThrowNode,
    TryNode,
    VarDeclareNode,
    WhileNode,
} from '../../semantics/semantics_nodes.js';
import {
    ClosureContextType,
    Primitive,
    ValueType,
} from '../../semantics/value_types.js';
import ts from 'typescript';
import { BuiltinNames } from '../../../lib/builtin/builtin_name.js';
import { SemanticsValue, VarValue } from '../../semantics/value.js';
import { getConfig } from '../../../config/config_mgr.js';

export class WASMStatementGen {
    private module;

    constructor(private wasmCompiler: WASMGen) {
        this.module = this.wasmCompiler.module;
    }

    WASMStmtGen(stmt: SemanticsNode): binaryen.ExpressionRef {
        let res: binaryen.ExpressionRef | null = null;
        this.module = this.wasmCompiler.module;

        switch (stmt.kind) {
            case SemanticsKind.IF: {
                res = this.wasmIf(<IfNode>stmt);
                break;
            }
            case SemanticsKind.BLOCK: {
                res = this.wasmBlock(<BlockNode>stmt);
                break;
            }
            case SemanticsKind.RETURN: {
                res = this.wasmReturn(<ReturnNode>stmt);
                break;
            }
            case SemanticsKind.EMPTY: {
                res = this.wasmEmpty();
                break;
            }
            case SemanticsKind.WHILE:
            case SemanticsKind.DOWHILE: {
                res = this.wasmLoop(<WhileNode>stmt);
                break;
            }
            case SemanticsKind.FOR: {
                res = this.wasmFor(<ForNode>stmt);
                break;
            }
            case SemanticsKind.SWITCH: {
                res = this.wasmSwitch(<SwitchNode>stmt);
                break;
            }
            case SemanticsKind.BREAK: {
                res = this.wasmBreak(<BreakNode>stmt);
                break;
            }
            case SemanticsKind.BASIC_BLOCK: {
                res = this.wasmBasicExpr(<BasicBlockNode>stmt);
                break;
            }
            case SemanticsKind.TRY: {
                res = this.wasmTry(<TryNode>stmt);
                break;
            }
            case SemanticsKind.THROW: {
                res = this.wasmThrow(<ThrowNode>stmt);
                break;
            }
            default:
                throw new Error('unexpected stmt kind ' + stmt.kind);
        }
        this.addDebugInfoRef(stmt, res);
        return res;
    }

    wasmIf(stmt: IfNode): binaryen.ExpressionRef {
        let wasmCond: binaryen.ExpressionRef =
            this.wasmCompiler.wasmExprComp.wasmExprGen(stmt.condition);
        wasmCond = FunctionalFuncs.generateCondition(
            this.module,
            wasmCond,
            stmt.condition.type.kind,
        );
        this.addDebugInfoRef(stmt.condition, wasmCond);
        /* if ture need to enter into a new scope */
        this.wasmCompiler.currentFuncCtx!.enterScope();
        this.wasmCompiler.currentFuncCtx!.insert(
            this.WASMStmtGen(stmt.trueNode),
        );
        const ifTrueStmts = this.wasmCompiler.currentFuncCtx!.exitScope();
        const wasmIfTrue: binaryen.ExpressionRef = this.module.block(
            null,
            ifTrueStmts,
        );
        /* if false need to enter into a new scope */
        let wasmIfFalse = undefined;
        if (stmt.falseNode) {
            this.wasmCompiler.currentFuncCtx!.enterScope();
            this.wasmCompiler.currentFuncCtx!.insert(
                this.WASMStmtGen(stmt.falseNode),
            );
            const ifFalseStmts = this.wasmCompiler.currentFuncCtx!.exitScope();
            wasmIfFalse = this.module.block(null, ifFalseStmts);
        }
        return this.module.if(wasmCond, wasmIfTrue, wasmIfFalse);
    }

    wasmBlock(stmt: BlockNode): binaryen.ExpressionRef {
        this.wasmCompiler.currentFuncCtx!.enterScope();
        /* assign value for block's context variable */
        if (
            stmt.varList &&
            stmt.varList[0].type instanceof ClosureContextType &&
            stmt.varList[0].initCtx
        ) {
            const freeVars: VarDeclareNode[] = [];
            for (const v of stmt.varList) {
                if (v.closureIndex !== undefined) {
                    freeVars.push(v);
                }
            }
            this.wasmCompiler.assignCtxVar(stmt.varList[0], freeVars);
        }
        for (const child of stmt.statements) {
            const childRef = this.WASMStmtGen(child);
            this.wasmCompiler.currentFuncCtx!.insert(childRef);
        }
        const statements = this.wasmCompiler.currentFuncCtx!.exitScope();
        return this.module.block(null, statements);
    }

    wasmReturn(stmt: ReturnNode): binaryen.ExpressionRef {
        const brReturn = this.module.br('statements');
        if (stmt.expr === undefined) {
            return brReturn;
        }
        const returnExprRef = this.wasmCompiler.wasmExprComp.wasmExprGen(
            stmt.expr,
        );
        this.addDebugInfoRef(stmt.expr, returnExprRef);
        if (binaryen.getExpressionType(returnExprRef) !== binaryen.none) {
            const setReturnValue = this.module.local.set(
                this.wasmCompiler.currentFuncCtx!.returnIdx,
                returnExprRef,
            );
            this.addDebugInfoRef(stmt, setReturnValue);
            this.wasmCompiler.currentFuncCtx!.insert(setReturnValue);
        } else {
            this.wasmCompiler.currentFuncCtx!.insert(returnExprRef);
        }

        return brReturn;
    }

    wasmEmpty(): binaryen.ExpressionRef {
        return this.wasmCompiler.module.nop();
    }

    wasmLoop(stmt: WhileNode): binaryen.ExpressionRef {
        this.wasmCompiler.currentFuncCtx!.enterScope();
        let WASMCond: binaryen.ExpressionRef =
            this.wasmCompiler.wasmExprComp.wasmExprGen(stmt.condition);
        const WASMStmts: binaryen.ExpressionRef = this.WASMStmtGen(stmt.body!);

        WASMCond = FunctionalFuncs.generateCondition(
            this.module,
            WASMCond,
            stmt.condition.type.kind,
        );
        this.addDebugInfoRef(stmt.condition, WASMCond);
        // this.WASMCompiler.addDebugInfoRef(stmt.loopCondtion, WASMCond);
        // (block $break
        //  (loop $loop_label
        //   ...
        //   (if cond
        //    ...
        //    (br $loop_label)
        //   )
        //  )
        // )
        const flattenLoop: FlattenLoop = {
            label: stmt.label,
            condition: WASMCond,
            statements: WASMStmts,
        };
        this.wasmCompiler.currentFuncCtx!.insert(
            this.module.loop(
                stmt.label,
                FunctionalFuncs.flattenLoopStatement(
                    this.module,
                    flattenLoop,
                    stmt.kind,
                ),
            ),
        );

        const statements = this.wasmCompiler.currentFuncCtx!.exitScope();
        return this.module.block(stmt.blockLabel, statements);
    }

    wasmFor(stmt: ForNode): binaryen.ExpressionRef {
        this.wasmCompiler.currentFuncCtx!.enterScope();
        let WASMCond: binaryen.ExpressionRef | undefined;
        let WASMIncrementor: binaryen.ExpressionRef | undefined;
        let WASMStmts: binaryen.ExpressionRef = this.wasmCompiler.module.nop();
        if (stmt.initialize) {
            const init = this.WASMStmtGen(stmt.initialize);
            if (stmt.initialize.kind === SemanticsKind.BASIC_BLOCK) {
                this.wasmCompiler.currentFuncCtx!.insert(init);
            }
        }
        if (stmt.condition) {
            WASMCond = this.wasmCompiler.wasmExprComp.wasmExprGen(
                stmt.condition,
            );
            this.addDebugInfoRef(stmt.condition, WASMCond);
        }
        if (stmt.next) {
            WASMIncrementor = this.wasmCompiler.wasmExprComp.wasmExprGen(
                stmt.next,
            );
            this.addDebugInfoRef(stmt.next, WASMIncrementor);
        }
        if (stmt.body) {
            WASMStmts = this.WASMStmtGen(stmt.body);
        }
        const flattenLoop: FlattenLoop = {
            label: stmt.label,
            condition: WASMCond,
            statements: WASMStmts,
            incrementor: WASMIncrementor,
        };

        this.wasmCompiler.currentFuncCtx!.insert(
            this.module.loop(
                stmt.label,
                FunctionalFuncs.flattenLoopStatement(
                    this.module,
                    flattenLoop,
                    stmt.kind,
                ),
            ),
        );

        const statements = this.wasmCompiler.currentFuncCtx!.exitScope();
        return this.module.block(stmt.blockLabel, statements);
    }

    wasmSwitch(stmt: SwitchNode): binaryen.ExpressionRef {
        const caseClause = stmt.caseClause;
        const condition = this.wasmCompiler.wasmExprComp.wasmExprGen(
            stmt.condition,
        );
        // this.WASMCompiler.addDebugInfoRef(stmt.switchCondition, WASMCond);
        if (caseClause.length === 0) {
            return this.wasmCompiler.module.nop();
        }
        const branches: binaryen.ExpressionRef[] = new Array(caseClause.length);
        let indexOfDefault = -1;
        let idx = 0;
        caseClause.forEach((clause, i) => {
            if (clause.kind === SemanticsKind.DEFAULT_CLAUSE) {
                indexOfDefault = i;
            } else {
                const caseCause = <CaseClauseNode>clause;
                const causeRef = this.wasmCompiler.wasmExprComp.wasmExprGen(
                    caseCause.caseVar,
                );

                // this.WASMCompiler.addDebugInfoRef(caseCause.caseExpr, causeRef);
                branches[idx++] = this.module.br(
                    'case' + i + stmt.label,
                    this.wasmCompiler.wasmExprComp.operateBinaryExpr(
                        stmt.condition,
                        caseCause.caseVar,
                        ts.SyntaxKind.EqualsEqualsEqualsToken,
                    ),
                );
            }
        });
        const default_label =
            indexOfDefault === -1
                ? stmt.breakLabel
                : 'case' + indexOfDefault + stmt.label;
        branches[idx] = this.module.br(default_label);

        let block = this.module.block('case0' + stmt.label, branches);
        for (let i = 0; i !== caseClause.length; ++i) {
            const clause = <CaseClauseNode | DefaultClauseNode>caseClause[i];
            const label =
                i === caseClause.length - 1
                    ? stmt.breakLabel
                    : 'case' + (i + 1) + stmt.label;
            block = this.module.block(
                label,
                [block].concat(this.WASMStmtGen(clause.body!)),
            );
        }
        return block;
    }

    wasmBreak(stmt: BreakNode): binaryen.ExpressionRef {
        return this.wasmCompiler.module.br(stmt.label);
    }

    wasmBasicExpr(stmt: BasicBlockNode): binaryen.ExpressionRef {
        this.wasmCompiler.currentFuncCtx!.enterScope();
        for (const exprStmt of stmt.valueNodes) {
            const exprRef =
                this.wasmCompiler.wasmExprComp.wasmExprGen(exprStmt);
            this.addDebugInfoRef(exprStmt, exprRef);
            this.wasmCompiler.currentFuncCtx!.insert(exprRef);
        }
        const basicStmts = this.wasmCompiler.currentFuncCtx!.exitScope();
        return this.module.block(null, basicStmts);
    }

    wasmTry(stmt: TryNode): binaryen.ExpressionRef {
        /* set tmp var */
        const tmpNeedRethrow = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
            this.wasmCompiler.wasmTypeComp.getWASMType(Primitive.Boolean),
        );
        const tmpException = this.wasmCompiler.currentFuncCtx!.insertTmpVar(
            this.wasmCompiler.wasmTypeComp.getWASMType(Primitive.Any),
        );
        const getTmpExceptionRef = this.module.local.get(
            tmpException.index,
            tmpException.type,
        );
        const setTmpExceptionRef = this.module.local.set(
            tmpException.index,
            this.module.anyref.pop(),
        );

        /* generate structure for one layer of ts try statement */
        const tryTSLable = stmt.label;
        const originTryRef = this.WASMStmtGen(stmt.body);
        const tryInCatchRef = this.module.block(null, [
            this.module.local.set(
                tmpNeedRethrow.index,
                this.module.i32.const(1),
            ),
            originTryRef,
        ]);
        const tryCatchLabel = tryTSLable.concat('_catch');
        const catchRefs: binaryen.ExpressionRef[] = [setTmpExceptionRef];
        if (stmt.catchClause) {
            /* set tmpException value to e variable: catch (e) */
            if (stmt.catchClause.catchVar) {
                const catchVarValue = stmt.catchClause.catchVar as VarValue;
                const catchVarDeclNode = catchVarValue.ref as VarDeclareNode;
                catchRefs.push(
                    this.module.local.set(
                        catchVarDeclNode.index,
                        getTmpExceptionRef,
                    ),
                );
            }
            const originCatchRef = this.WASMStmtGen(stmt.catchClause.body);
            catchRefs.push(
                this.module.local.set(
                    tmpNeedRethrow.index,
                    this.module.i32.const(0),
                ),
            );
            catchRefs.push(originCatchRef);
        }
        catchRefs.push(
            this.module.throw(BuiltinNames.finallyTag, [getTmpExceptionRef]),
        );
        const innerTryRef = this.module.try(
            tryCatchLabel,
            tryInCatchRef,
            [BuiltinNames.errorTag],
            [this.module.block(null, catchRefs)],
        );
        const tryFinallyLabel = tryTSLable.concat('_finally');
        const finallyRefs: binaryen.ExpressionRef[] = [setTmpExceptionRef];
        if (stmt.finallyBlock) {
            const originFinallyRef = this.WASMStmtGen(stmt.finallyBlock);
            finallyRefs.push(originFinallyRef);
        }
        finallyRefs.push(
            this.module.if(
                this.module.i32.eq(
                    this.module.local.get(
                        tmpNeedRethrow.index,
                        tmpNeedRethrow.type,
                    ),
                    this.module.i32.const(1),
                ),
                this.module.throw(BuiltinNames.errorTag, [getTmpExceptionRef]),
            ),
        );
        const outerTryRef = this.module.try(
            tryFinallyLabel,
            innerTryRef,
            [BuiltinNames.finallyTag],
            [this.module.block(null, finallyRefs)],
        );
        return outerTryRef;
    }

    wasmThrow(stmt: ThrowNode): binaryen.ExpressionRef {
        const throwExpr = stmt.throwExpr;
        const exprRef = this.wasmCompiler.wasmExprComp.wasmExprGen(throwExpr);
        this.addDebugInfoRef(throwExpr, exprRef);
        /* workaround: only support anyref error in the first version */
        return this.module.throw(BuiltinNames.errorTag, [
            FunctionalFuncs.boxToAny(this.module, exprRef, throwExpr),
        ]);
    }

    addDebugInfoRef(
        irNode: SemanticsNode | SemanticsValue,
        ref: binaryen.ExpressionRef,
    ) {
        if (getConfig().sourceMap && irNode.location) {
            this.wasmCompiler.currentFuncCtx!.sourceMapLocs.push({
                location: irNode.location,
                ref: ref,
            });
        }
    }
}
