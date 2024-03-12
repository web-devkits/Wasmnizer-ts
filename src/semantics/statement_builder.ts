/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

import { Logger } from '../log.js';
import {
    buildExpression,
    newCastValue,
    newBinaryExprValue,
    buildFunctionExpression,
} from './expression_builder.js';

import { generateChildrenFunctionScope } from './index.js';

import {
    SemanticsKind,
    SemanticsNode,
    VarDeclareNode,
    VarStorageType,
    EmptyNode,
    BasicBlockNode,
    BlockNode,
    IfNode,
    ForNode,
    WhileNode,
    CaseClauseNode,
    DefaultClauseNode,
    SwitchNode,
    ReturnNode,
    BreakNode,
    ContinueNode,
    CatchClauseNode,
    TryNode,
    ThrowNode,
} from './semantics_nodes.js';

import { Variable } from '../variable.js';
import { Scope, ScopeKind } from '../scope.js';

import {
    Statement,
    IfStatement,
    BlockStatement,
    ReturnStatement,
    BaseLoopStatement,
    ForStatement,
    ExpressionStatement,
    CaseClause,
    DefaultClause,
    CaseBlock,
    SwitchStatement,
    BreakStatement,
    VariableStatement,
    FunctionDeclarationStatement,
    CatchClauseStatement,
    TryStatement,
    ThrowStatement,
    ContinueStatement,
} from '../statement.js';

import {
    ReBindingValue,
    SemanticsValue,
    SemanticsValueKind,
    VarValue,
    VarValueKind,
} from './value.js';

import { ValueType, ValueTypeKind, Primitive } from './value_types.js';

import {
    BuildContext,
    SymbolValue,
    SymbolKey,
    SymbolKeyToString,
    ValueReferenceKind,
} from './builder_context.js';
import { createType } from './type_creator.js';
import { getNodeLoc } from '../utils.js';
import { getConfig } from '../../config/config_mgr.js';

export function createFromVariable(
    v: Variable,
    as_global: boolean,
    context: BuildContext,
): VarDeclareNode {
    let storageType: VarStorageType = as_global
        ? SemanticsValueKind.GLOBAL_CONST
        : SemanticsValueKind.LOCAL_CONST;
    if (!v.isConst() && !v.isReadOnly()) {
        if (as_global) storageType = SemanticsValueKind.GLOBAL_VAR;
        else storageType = SemanticsValueKind.LOCAL_VAR;
    }

    const type = createType(context, v.varType) as ValueType;
    if (!type) {
        throw Error(
            `Cannot found the type of ${v.varType} for variable:"${v.varName}(${
                v.mangledName
            })" owner scope: ${v.scope ? v.scope!.mangledName : 'No Scope'}`,
        );
    }

    Logger.debug(
        `=== find variable "${v.varName}(${v.mangledName} in scope ${
            v.scope ? v.scope!.mangledName : ''
        })" type: ${type}`,
    );
    return new VarDeclareNode(
        storageType,
        type!,
        v.varName,
        v.varIndex,
        0,
        undefined,
        v.closureIndex,
        v.belongCtx
            ? createFromVariable(v.belongCtx, false, context)
            : undefined,
        v.initContext
            ? createFromVariable(v.initContext, false, context)
            : undefined,
        v.needReBinding,
    );
}

export function createLocalSymbols(
    scope: Scope,
    context: BuildContext,
): [VarDeclareNode[] | undefined, Map<SymbolKey, SymbolValue> | undefined] {
    let varList: VarDeclareNode[] | undefined = undefined;
    let symbols: Map<SymbolKey, SymbolValue> | undefined = undefined;
    const vararr = scope!.varArray;
    if (vararr.length > 0) {
        symbols = new Map<SymbolKey, SymbolValue>();
        varList = [];
        for (const v of vararr) {
            const node = createFromVariable(v, false, context);
            const value = new VarValue(
                node.storageType,
                node.type,
                node,
                node.index,
            );
            Logger.debug(`=== var ${v.varName} value: ${value}`);
            Logger.debug(
                `=== createLocalSymbols ${SymbolKeyToString(
                    v,
                )} value: ${value.toString()}`,
            );
            varList.push(node);
            symbols.set(v, value);
        }
    }

    for (const child of scope!.children) {
        Logger.debug(
            `====== createLocalSymbols child scope:${
                child.kind
            }, ${child.getName()}`,
        );
        if (child.kind == ScopeKind.NamespaceScope) {
            if (symbols == undefined) symbols = new Map();
            const value = new VarValue(
                SemanticsValueKind.GLOBAL_CONST,
                Primitive.Namespace,
                child,
                child.getName(),
            );
            symbols.set(child, value);
        }
    }

    return [varList, symbols];
}

function buildBlock(
    block: BlockStatement,
    context: BuildContext,
): SemanticsNode {
    const scope = block.getScope();
    const [statements, varList] = buildStatementsWithScope(
        scope!,
        scope!.statements,
        context,
    );

    return new BlockNode(statements, varList);
}

function buildStatementsWithScope(
    scope: Scope,
    statementsFrom: Statement[],
    context: BuildContext,
): [SemanticsNode[], VarDeclareNode[] | undefined] {
    const statements: SemanticsNode[] = [];
    let basic_block: BasicBlockNode | undefined = undefined;

    context.push(scope);

    const [varList, symbols] = createLocalSymbols(scope, context);

    if (symbols) {
        symbols!.forEach((v, k) =>
            Logger.debug(
                `== block local ${SymbolKeyToString(k)}, ${v.toString()}`,
            ),
        );
        context.updateNamedSymbolByScope(scope, symbols);
    }

    // build the child function scope
    generateChildrenFunctionScope(context, scope);

    for (const st of statementsFrom) {
        const r = buildStatement(st, context);
        if (r instanceof SemanticsValue) {
            if (!basic_block) {
                basic_block = new BasicBlockNode();
                statements.push(basic_block);
            }
            basic_block.pushSemanticsValue(r as SemanticsValue);
        } else {
            basic_block = undefined;
            const node = r as SemanticsNode;
            statements.push(node);
        }
    }

    context.pop();

    return [statements, varList];
}

function buildCaseClauseStatements(
    clause: CaseClause | DefaultClause,
    context: BuildContext,
): SemanticsNode {
    const scope = clause.getScope();
    const [statements, varList] = buildStatementsWithScope(
        scope!,
        clause.caseStatements,
        context,
    );

    return new BlockNode(statements, varList);
}

function buildVariableStatement(
    statement: VariableStatement,
    context: BuildContext,
): SemanticsNode {
    const basic_block = new BasicBlockNode();
    for (const v of statement.varArray) {
        if (v.initExpression != null) {
            const init_value = buildExpression(v.initExpression, context);
            const ret = context.findSymbol(v.varName);
            if (!ret) {
                throw Error(`var ${v.varName} is not decleared`);
            }

            let var_value: VarValue | undefined = undefined;

            if (ret instanceof VarDeclareNode) {
                const var_decl = ret as VarDeclareNode;
                var_decl.initValue = init_value;
                var_value = new VarValue(
                    var_decl.storageType as VarValueKind,
                    var_decl.type,
                    var_decl,
                    var_decl.index,
                );
            } else if (ret instanceof VarValue) {
                var_value = ret as VarValue;
                if (var_value.ref instanceof VarDeclareNode) {
                    var_value.ref.initValue = init_value;
                }
            } else {
                throw Error(`var ${v.varName} unexcept type ${ret}`);
            }

            context.pushReference(ValueReferenceKind.RIGHT);
            context.popReference();
            const assignment = newBinaryExprValue(
                var_value!.type,
                ts.SyntaxKind.EqualsToken,
                var_value!,
                init_value,
            );
            if (v.tsNode && getConfig().sourceMap) {
                assignment.location = getNodeLoc(v.tsNode);
            }
            basic_block.pushSemanticsValue(assignment);
        }
    }
    return basic_block;
}

function buildStatementAsNode(
    statement: Statement,
    context: BuildContext,
): SemanticsNode {
    const r = buildStatement(statement, context);
    if (r instanceof SemanticsValue) {
        const b = new BasicBlockNode();
        b.pushSemanticsValue(r as SemanticsValue);
        return b;
    }
    return r as SemanticsNode;
}

function buildIfStatement(
    statement: IfStatement,
    context: BuildContext,
): SemanticsNode {
    context.pushReference(ValueReferenceKind.RIGHT);
    let condition = buildExpression(statement.ifCondition, context);
    context.popReference();

    condition = newCastValue(Primitive.Boolean, condition);

    const trueStmt = buildStatementAsNode(statement.ifIfTrue, context);
    let falseStmt: SemanticsNode | undefined = undefined;
    if (statement.ifIfFalse != null)
        falseStmt = buildStatementAsNode(statement.ifIfFalse, context);

    return new IfNode(condition, trueStmt, falseStmt);
}

function buildReturnStatement(
    statement: ReturnStatement,
    context: BuildContext,
): SemanticsNode {
    context.pushReference(ValueReferenceKind.RIGHT);
    let returnvalue =
        statement.returnExpression != null
            ? buildExpression(statement.returnExpression!, context)
            : undefined;
    context.popReference();

    if (returnvalue) {
        const func = context.currentFunction();
        if (func) {
            const func_type = func.funcType;
            const ret_type = func_type.returnType;
            if (ret_type.kind !== ValueTypeKind.VOID) {
                if (!ret_type.equals(returnvalue.type)) {
                    returnvalue = newCastValue(ret_type, returnvalue);
                }
            }
        }
    }
    return new ReturnNode(returnvalue);
}

function buildBaseLoopStatement(
    statement: BaseLoopStatement,
    context: BuildContext,
): SemanticsNode {
    context.pushReference(ValueReferenceKind.RIGHT);
    let condition = buildExpression(statement.loopCondtion, context);
    context.popReference();
    condition = newCastValue(Primitive.Boolean, condition);

    const body = buildStatementAsNode(statement.loopBody, context);

    return new WhileNode(
        statement.statementKind == ts.SyntaxKind.WhileStatement
            ? SemanticsKind.WHILE
            : SemanticsKind.DOWHILE,
        statement.loopLabel,
        statement.loopBlockLabel,
        statement.loopContinueLable,
        condition,
        body,
    );
}

function buildForStatement(
    statement: ForStatement,
    context: BuildContext,
): SemanticsNode {
    // TODO process var
    Logger.debug(
        `==== statement: scope: ${SymbolKeyToString(statement.getScope()!)}`,
    );
    const scope = statement.getScope()!;
    const [varList, symbols] = createLocalSymbols(scope, context);
    context.push(scope, symbols);
    const initialize =
        statement.forLoopInitializer != null
            ? buildStatementAsNode(statement.forLoopInitializer, context)
            : undefined;

    context.pushReference(ValueReferenceKind.RIGHT);
    const condition =
        statement.forLoopCondtion != null
            ? buildExpression(statement.forLoopCondtion, context)
            : undefined;

    const next =
        statement.forLoopIncrementor != null
            ? buildExpression(statement.forLoopIncrementor, context)
            : undefined;
    context.popReference();

    const body = buildStatementAsNode(statement.forLoopBody, context);

    const reBindedStmts = [body];
    if (varList) {
        const b = new BasicBlockNode();
        const handledCtxs: VarDeclareNode[] = [];
        for (const varNode of varList) {
            if (varNode.needReBinding && varNode.belongCtx) {
                if (!handledCtxs.includes(varNode.belongCtx)) {
                    handledCtxs.push(varNode.belongCtx);
                    const reBindingValue = new ReBindingValue(
                        varNode.belongCtx,
                    );
                    b.pushSemanticsValue(reBindingValue);
                }
            }
        }
        reBindedStmts.push(b);
    }

    const finally_body = new BlockNode(reBindedStmts);

    context.pop();

    /*TODO: varList can be removed from ForNode, since varList is recorded in outter block scope */
    return new ForNode(
        statement.forLoopLabel,
        statement.forLoopBlockLabel,
        statement.forContinueLable,
        varList,
        initialize,
        condition,
        next,
        finally_body,
    );
}

function buildSwitchStatement(
    statement: SwitchStatement,
    context: BuildContext,
): SemanticsNode {
    context.pushReference(ValueReferenceKind.RIGHT);
    const condition = buildExpression(statement.switchCondition, context);
    context.popReference();

    const case_block = statement.switchCaseBlock as CaseBlock;

    const case_nodes: CaseClauseNode[] = [];
    let default_node: DefaultClauseNode | undefined = undefined;

    for (const clause of case_block.caseCauses) {
        if (clause.statementKind == ts.SyntaxKind.DefaultClause) {
            const default_cause = buildCaseClauseStatements(
                clause as DefaultClause,
                context,
            );
            if (getConfig().sourceMap) {
                default_cause.location = getNodeLoc(clause.tsNode!);
            }
            default_node = new DefaultClauseNode(default_cause);
        } else {
            const case_clause = clause as CaseClause;
            context.pushReference(ValueReferenceKind.RIGHT);
            const case_expr = buildExpression(case_clause.caseExpr, context);
            context.popReference();
            const cause = buildCaseClauseStatements(case_clause, context);
            if (getConfig().sourceMap) {
                cause.location = getNodeLoc(case_clause.tsNode!);
            }
            case_nodes.push(new CaseClauseNode(case_expr, cause));
        }
    }

    return new SwitchNode(
        case_block.switchLabel,
        case_block.breakLabel,
        condition,
        case_nodes,
        default_node,
    );
}

function buildBreakStatement(statement: BreakStatement): SemanticsNode {
    return new BreakNode(statement.breakLabel);
}

function buildContinueStatement(statement: ContinueStatement): SemanticsNode {
    return new ContinueNode(statement.continueLabel);
}

function buildThrowStatement(
    statement: ThrowStatement,
    context: BuildContext,
): SemanticsNode {
    const throw_expr = buildExpression(statement.expr, context);
    return new ThrowNode(throw_expr);
}

function buildCatchClauseStatement(
    statement: CatchClauseStatement,
    context: BuildContext,
): SemanticsNode {
    const catch_block_node = buildBlock(statement.catchBlockStmt, context);
    const catch_clause_node = new CatchClauseNode(catch_block_node);
    if (statement.catchVar) {
        const catch_var_value = buildExpression(statement.catchVar, context);
        catch_clause_node.catchVar = catch_var_value;
    }
    return catch_clause_node;
}

function buildTryStatement(
    statement: TryStatement,
    context: BuildContext,
): SemanticsNode {
    const try_block_node = buildBlock(statement.tryBlockStmt, context);
    if (getConfig().sourceMap) {
        try_block_node.location = getNodeLoc(statement.tryBlockStmt.tsNode!);
    }
    let catch_clause_node = undefined;
    if (statement.catchClauseStmt) {
        catch_clause_node = buildCatchClauseStatement(
            statement.catchClauseStmt,
            context,
        );
        if (getConfig().sourceMap) {
            try_block_node.location = getNodeLoc(
                statement.catchClauseStmt.tsNode!,
            );
        }
    }
    let finally_block_node = undefined;
    if (statement.finallyBlockStmt) {
        finally_block_node = buildBlock(statement.finallyBlockStmt, context);
        if (getConfig().sourceMap) {
            try_block_node.location = getNodeLoc(
                statement.finallyBlockStmt.tsNode!,
            );
        }
    }
    return new TryNode(
        statement.label,
        try_block_node,
        catch_clause_node as CatchClauseNode,
        finally_block_node,
    );
}

export function buildStatement(
    statement: Statement,
    context: BuildContext,
): SemanticsNode | SemanticsValue {
    Logger.debug(
        `======= buildStatement: ${ts.SyntaxKind[statement.statementKind]}`,
    );
    let res: SemanticsNode | SemanticsValue | null = null;
    try {
        switch (statement.statementKind) {
            case ts.SyntaxKind.Block:
                res = buildBlock(statement as BlockStatement, context);
                break;
            case ts.SyntaxKind.IfStatement:
                res = buildIfStatement(statement as IfStatement, context);
                break;
            case ts.SyntaxKind.ReturnStatement:
                res = buildReturnStatement(
                    statement as ReturnStatement,
                    context,
                );
                break;
            case ts.SyntaxKind.DoStatement:
            /* falls through */
            case ts.SyntaxKind.WhileStatement:
                res = buildBaseLoopStatement(
                    statement as BaseLoopStatement,
                    context,
                );
                break;
            case ts.SyntaxKind.ForStatement:
                res = buildForStatement(statement as ForStatement, context);
                break;
            /* falls through */
            case ts.SyntaxKind.ExpressionStatement:
                res = buildExpression(
                    (statement as ExpressionStatement).expression,
                    context,
                );
                break;
            /* falls through */
            case ts.SyntaxKind.CaseClause:
                //return buildCaseClauseStatement(statement as CaseClause, context);
                break;
            case ts.SyntaxKind.DefaultClause:
                //return buildDefaultClauseStatement(statement as DefaultClause, context);
                break; // call it in buildCaseClauseStatements
            case ts.SyntaxKind.SwitchStatement:
                res = buildSwitchStatement(
                    statement as SwitchStatement,
                    context,
                );
                break;
            /* falls through */
            case ts.SyntaxKind.CaseBlock:
                break; // call it in buildSwitchStatement statement
            case ts.SyntaxKind.BreakStatement:
                res = buildBreakStatement(statement as BreakStatement);
                break;
            case ts.SyntaxKind.ContinueStatement:
                res = buildContinueStatement(statement as ContinueStatement);
                break;
            case ts.SyntaxKind.VariableStatement:
                return buildVariableStatement(
                    statement as VariableStatement,
                    context,
                );
            case ts.SyntaxKind.FunctionDeclaration: {
                if (!context.currentFunction()) return new EmptyNode(); // global statement
                const funcStmt = statement as FunctionDeclarationStatement;
                const funcScope = funcStmt.funcScope;
                const var_value_tmp = context.findSymbolKey(funcStmt.tmpVar!);
                if (!var_value_tmp) {
                    throw Error(
                        `Cannot found the function scope var ${funcScope.getName()}`,
                    );
                }
                const var_value = var_value_tmp! as VarValue;
                const new_closure = buildFunctionExpression(funcScope, context);
                return newBinaryExprValue(
                    var_value.type,
                    ts.SyntaxKind.EqualsToken,
                    var_value,
                    new_closure,
                );
            }
            case ts.SyntaxKind.ThrowStatement:
                res = buildThrowStatement(statement as ThrowStatement, context);
                break;
            case ts.SyntaxKind.TryStatement:
                res = buildTryStatement(statement as TryStatement, context);
                break;
            case ts.SyntaxKind.EmptyStatement:
                res = new EmptyNode();
                break;
            /* falls through */
        }
        if (res && getConfig().sourceMap) {
            res.location = statement.debugLoc;
        }
        if (!res) {
            res = new EmptyNode();
        }
        return res;
    } catch (e: any) {
        console.log(e);
        Logger.error(e);
        const tsNode = statement.tsNode!;
        const sourceFile = tsNode.getSourceFile();
        const start = tsNode.getStart(sourceFile);
        const startLineInfo = sourceFile.getLineAndCharacterOfPosition(start);
        Logger.error(
            `[ERROR] @ "${sourceFile.fileName}" line: ${
                startLineInfo.line + 1
            } @${
                startLineInfo.character
            }  end: ${tsNode.getEnd()}  width: ${tsNode.getWidth(sourceFile)}`,
        );
        Logger.error(`Source: ${tsNode.getFullText(sourceFile)}`);
        throw Error(e);
    }
}
