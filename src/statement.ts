/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import { assert } from 'console';
import { ParserContext } from './frontend.js';
import {
    BinaryExpression,
    CallExpression,
    ElementAccessExpression,
    Expression,
    IdentifierExpression,
    NumberLiteralExpression,
    PropertyAccessExpression,
    UnaryExpression,
    UndefinedKeywordExpression,
    SuperExpression,
    ArrayLiteralExpression,
    StringLiteralExpression,
    EnumerateKeysExpression,
} from './expression.js';
import { Scope, ScopeKind, FunctionScope } from './scope.js';
import {
    parentIsFunctionLike,
    Stack,
    getModulePath,
    getGlobalScopeByModuleName,
    SourceLocation,
    addSourceMapLoc,
    getCurScope,
} from './utils.js';
import { ModifierKind, Variable } from './variable.js';
import {
    TSArray,
    TSClass,
    TSFunction,
    Type,
    TypeKind,
    builtinTypes,
} from './type.js';
import { Logger } from './log.js';
import { StatementError, UnimplementError } from './error.js';
import { getConfig } from '../config/config_mgr.js';

type StatementKind = ts.SyntaxKind;

export class Statement {
    private _scope: Scope | null = null;
    debugLoc: SourceLocation | null = null;
    public tsNode?: ts.Node;

    constructor(private kind: StatementKind) {}

    get statementKind(): StatementKind {
        return this.kind;
    }

    setScope(scope: Scope) {
        this._scope = scope;
    }

    getScope(): Scope | null {
        return this._scope;
    }
}

/** in order to keep order of namespace in parent level scope, creat a corresponding statement
 * for namespace
 */
export class ModDeclStatement extends Statement {
    constructor(public scope: Scope) {
        super(ts.SyntaxKind.ModuleDeclaration);
    }
}

export class IfStatement extends Statement {
    constructor(
        private condition: Expression,
        private ifTrue: Statement,
        private ifFalse: Statement | null,
    ) {
        super(ts.SyntaxKind.IfStatement);
    }

    get ifCondition(): Expression {
        return this.condition;
    }

    get ifIfTrue(): Statement {
        return this.ifTrue;
    }

    get ifIfFalse(): Statement | null {
        return this.ifFalse;
    }
}

export class BlockStatement extends Statement {
    constructor() {
        super(ts.SyntaxKind.Block);
    }
}

export class ReturnStatement extends Statement {
    constructor(private expr: Expression | null) {
        super(ts.SyntaxKind.ReturnStatement);
    }

    get returnExpression(): Expression | null {
        return this.expr;
    }
}

// create 'while' or 'do...while' loop
export class BaseLoopStatement extends Statement {
    constructor(
        kind: StatementKind,
        private _loopLabel: string,
        private _blockLabel: string,
        private cond: Expression,
        private body: Statement,
    ) {
        super(kind);
    }

    get loopLabel(): string {
        return this._loopLabel;
    }

    get loopBlockLabel(): string {
        return this._blockLabel;
    }

    get loopCondtion(): Expression {
        return this.cond;
    }

    get loopBody(): Statement {
        return this.body;
    }
}

export class ForStatement extends Statement {
    constructor(
        private label: string,
        private blockLabel: string,
        private cond: Expression | null,
        private body: Statement,
        /** VariableStatement or ExpressionStatement */
        private initializer: Statement | null,
        private incrementor: Expression | null,
    ) {
        super(ts.SyntaxKind.ForStatement);
    }

    get forLoopLabel(): string {
        return this.label;
    }

    get forLoopBlockLabel(): string {
        return this.blockLabel;
    }

    get forLoopCondtion(): Expression | null {
        return this.cond;
    }

    get forLoopBody(): Statement {
        return this.body;
    }

    get forLoopInitializer(): Statement | null {
        return this.initializer;
    }

    get forLoopIncrementor(): Expression | null {
        return this.incrementor;
    }
}

export class ExpressionStatement extends Statement {
    constructor(private expr: Expression) {
        super(ts.SyntaxKind.ExpressionStatement);
    }

    get expression(): Expression {
        return this.expr;
    }
}

export class EmptyStatement extends Statement {
    constructor() {
        super(ts.SyntaxKind.EmptyStatement);
    }
}

export class CaseClause extends Statement {
    constructor(private expr: Expression, private statements: Statement[]) {
        super(ts.SyntaxKind.CaseClause);
    }

    get caseExpr(): Expression {
        return this.expr;
    }

    get caseStatements(): Statement[] {
        return this.statements;
    }
}

export class DefaultClause extends Statement {
    constructor(private statements: Statement[]) {
        super(ts.SyntaxKind.DefaultClause);
    }

    get caseStatements(): Statement[] {
        return this.statements;
    }
}

export class CaseBlock extends Statement {
    constructor(
        private _switchLabel: string,
        private _breakLabel: string,
        private causes: Statement[],
    ) {
        super(ts.SyntaxKind.CaseBlock);
    }

    get switchLabel(): string {
        return this._switchLabel;
    }

    get breakLabel(): string {
        return this._breakLabel;
    }

    get caseCauses(): Statement[] {
        return this.causes;
    }
}
export class SwitchStatement extends Statement {
    constructor(private cond: Expression, private caseBlock: Statement) {
        super(ts.SyntaxKind.SwitchStatement);
    }

    get switchCondition(): Expression {
        return this.cond;
    }

    get switchCaseBlock(): Statement {
        return this.caseBlock;
    }
}

export class BreakStatement extends Statement {
    constructor(private label: string) {
        super(ts.SyntaxKind.BreakStatement);
    }

    get breakLabel(): string {
        return this.label;
    }
}

export class FunctionDeclarationStatement extends Statement {
    public tmpVar?: Variable;

    constructor(private _funcScope: FunctionScope) {
        super(ts.SyntaxKind.FunctionDeclaration);
    }

    get funcScope(): FunctionScope {
        return this._funcScope;
    }
}

export class VariableStatement extends Statement {
    private variableArray: Variable[] = [];

    constructor() {
        super(ts.SyntaxKind.VariableStatement);
    }

    addVariable(variable: Variable) {
        this.variableArray.push(variable);
    }

    get varArray(): Variable[] {
        return this.variableArray;
    }
}

export class ImportDeclaration extends Statement {
    importModuleStartFuncName = '';

    constructor() {
        super(ts.SyntaxKind.ImportDeclaration);
    }
}

export class ThrowStatement extends Statement {
    expr: Expression;

    constructor(expr: Expression) {
        super(ts.SyntaxKind.ThrowStatement);
        this.expr = expr;
    }
}

export class CatchClauseStatement extends Statement {
    catchBlockStmt: BlockStatement;
    catchVar: IdentifierExpression | undefined = undefined;

    constructor(catchBlock: BlockStatement) {
        super(ts.SyntaxKind.CatchClause);
        this.catchBlockStmt = catchBlock;
    }
}

export class TryStatement extends Statement {
    label: string;
    tryBlockStmt: BlockStatement;
    catchClauseStmt: CatchClauseStatement | undefined = undefined;
    finallyBlockStmt: BlockStatement | undefined = undefined;

    constructor(tryLable: string, tryBlock: BlockStatement) {
        super(ts.SyntaxKind.TryStatement);
        this.label = tryLable;
        this.tryBlockStmt = tryBlock;
    }
}

export default class StatementProcessor {
    private loopLabelStack = new Stack<string>();
    private breakLabelsStack = new Stack<string>();
    private switchLabelStack = new Stack<number>();
    private tryLabelStack = new Stack<number>();
    private currentScope: Scope | null = null;
    private emitSourceMap = false;

    constructor(private parserCtx: ParserContext) {}

    visit() {
        this.emitSourceMap = getConfig().sourceMap;
        this.parserCtx.nodeScopeMap.forEach((scope, node) => {
            this.currentScope = scope;
            /** arrow function body is a ts.expression */
            if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
                const expr = this.parserCtx.expressionProcessor.visitNode(
                    node.body,
                );
                const returnType = (scope as FunctionScope).funcType.returnType;
                const stmt =
                    returnType.kind === TypeKind.VOID
                        ? new ExpressionStatement(expr)
                        : new ReturnStatement(expr);
                scope.addStatement(stmt);
            }
            /* During the traverse, it will enter the inner
            block scope, so we skip BlockScope here */
            if (
                scope.kind !== ScopeKind.BlockScope &&
                scope.kind !== ScopeKind.ClassScope
            ) {
                ts.forEachChild(node, (node) => {
                    const stmt = this.visitNode(node);
                    if (stmt) {
                        scope.addStatement(stmt);
                    }
                });
            }
        });
    }

    visitNode(node: ts.Node): Statement | null {
        const stm = this.visitNodeInternal(node);
        if (stm != null) stm.tsNode = node;
        return stm;
    }

    visitNodeInternal(node: ts.Node): Statement | null {
        switch (node.kind) {
            case ts.SyntaxKind.ExportDeclaration:
            case ts.SyntaxKind.ImportDeclaration: {
                const importDeclaration = <
                    ts.ImportDeclaration | ts.ExportDeclaration
                >node;
                // Get the import module name according to the relative position of current scope
                const importModuleName = getModulePath(
                    importDeclaration,
                    this.currentScope!.getRootGloablScope()!,
                );
                if (importModuleName === undefined) return null;
                const importModuleScope = getGlobalScopeByModuleName(
                    importModuleName!,
                    this.parserCtx.globalScopes,
                );
                const importStmt = new ImportDeclaration();
                if (!importModuleScope.isCircularImport) {
                    const currentGlobalScope =
                        this.currentScope!.getRootGloablScope()!;
                    currentGlobalScope.importStartFuncNameList.push(
                        importModuleScope.startFuncName,
                    );
                    importModuleScope.isCircularImport = true;

                    importStmt.importModuleStartFuncName =
                        importModuleScope.startFuncName;
                    return importStmt;
                }
                /** Currently, we put all ts files into a whole wasm file.
                 *  So we don't need to collect import information here.
                 *  If we generate several wasm files, we need to collect here.
                 */
                return importStmt;
            }
            case ts.SyntaxKind.VariableStatement: {
                const varStatementNode = <ts.VariableStatement>node;
                const varStatement = new VariableStatement();
                const varDeclarationList = varStatementNode.declarationList;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                this.addVariableInVarStmt(
                    varDeclarationList,
                    varStatement,
                    this.currentScope,
                );
                return varStatement;
            }
            case ts.SyntaxKind.IfStatement: {
                const ifStatementNode = <ts.IfStatement>node;
                const condtion: Expression =
                    this.parserCtx.expressionProcessor.visitNode(
                        ifStatementNode.expression,
                    );
                const ifTrue: Statement = this.visitNode(
                    ifStatementNode.thenStatement,
                )!;
                const ifFalse: Statement | null = ifStatementNode.elseStatement
                    ? this.visitNode(ifStatementNode.elseStatement)
                    : null;
                const ifStmt = new IfStatement(condtion, ifTrue, ifFalse);
                if (this.emitSourceMap) {
                    addSourceMapLoc(ifStmt, node);
                }
                return ifStmt;
            }
            case ts.SyntaxKind.Block: {
                /* every ts.Block(except function.body) has a corresponding block scope and BlockStatement */
                const blockNode = <ts.Block>node;
                const scope = this.parserCtx.getScopeByNode(blockNode)!;

                for (const stmt of blockNode.statements) {
                    const compiledStmt = this.visitNode(stmt)!;
                    if (!compiledStmt) {
                        continue;
                    }
                    if (
                        compiledStmt instanceof ExpressionStatement &&
                        compiledStmt.expression instanceof SuperExpression &&
                        scope.statements.length > 0 // must be the first statement
                    ) {
                        scope.statements.unshift(compiledStmt);
                    } else {
                        scope.addStatement(compiledStmt);
                    }
                }

                /* Block of function scope, just add statements to parent scope,
                    don't create a new BlockStatement */
                if (parentIsFunctionLike(node)) {
                    return null;
                }

                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.ReturnStatement: {
                const returnStatementNode = <ts.ReturnStatement>node;
                const retStmt = new ReturnStatement(
                    returnStatementNode.expression
                        ? this.parserCtx.expressionProcessor.visitNode(
                              returnStatementNode.expression,
                          )
                        : null,
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(retStmt, node);
                }
                return retStmt;
            }
            case ts.SyntaxKind.WhileStatement: {
                const whileStatementNode = <ts.WhileStatement>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const loopLabel = 'while_loop_' + this.loopLabelStack.size();
                const breakLabels = this.breakLabelsStack;
                breakLabels.push(loopLabel + 'block');
                const blockLabel = breakLabels.peek();
                this.loopLabelStack.push(loopLabel);

                const expr = this.parserCtx.expressionProcessor.visitNode(
                    whileStatementNode.expression,
                );
                const statement = this.visitNode(whileStatementNode.statement)!;
                this.breakLabelsStack.pop();
                const loopStatment = new BaseLoopStatement(
                    ts.SyntaxKind.WhileStatement,
                    loopLabel,
                    blockLabel,
                    expr,
                    statement,
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(loopStatment, node);
                }
                loopStatment.setScope(scope);
                /* current scope is outter block scope */
                scope.addStatement(loopStatment);
                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.DoStatement: {
                const doWhileStatementNode = <ts.DoStatement>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const loopLabel = 'do_loop_' + this.loopLabelStack.size();
                const breakLabels = this.breakLabelsStack;
                breakLabels.push(loopLabel + 'block');
                const blockLabel = breakLabels.peek();
                this.loopLabelStack.push(loopLabel);

                const expr = this.parserCtx.expressionProcessor.visitNode(
                    doWhileStatementNode.expression,
                );
                const statement = this.visitNode(
                    doWhileStatementNode.statement,
                )!;
                this.breakLabelsStack.pop();
                const loopStatment = new BaseLoopStatement(
                    ts.SyntaxKind.DoStatement,
                    loopLabel,
                    blockLabel,
                    expr,
                    statement,
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(loopStatment, node);
                }
                loopStatment.setScope(scope);

                /* current scope is outter block scope */
                scope.addStatement(loopStatment);
                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.ForStatement: {
                const forStatementNode = <ts.ForStatement>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const loopLabel = 'for_loop_' + this.loopLabelStack.size();
                const breakLabels = this.breakLabelsStack;
                breakLabels.push(loopLabel + 'block');
                const blockLabel = breakLabels.peek();
                this.loopLabelStack.push(loopLabel);

                let initializer = null;
                if (forStatementNode.initializer) {
                    const forInit = forStatementNode.initializer;
                    let initStmt: Statement;
                    if (ts.isVariableDeclarationList(forInit)) {
                        initStmt = new VariableStatement();
                        this.addVariableInVarStmt(
                            forInit,
                            initStmt as VariableStatement,
                            scope,
                            true,
                        );
                    } else {
                        initStmt = new ExpressionStatement(
                            this.parserCtx.expressionProcessor.visitNode(
                                forInit,
                            ),
                        );
                    }
                    initializer = initStmt;
                }

                const cond = forStatementNode.condition
                    ? this.parserCtx.expressionProcessor.visitNode(
                          forStatementNode.condition,
                      )
                    : null;
                const incrementor = forStatementNode.incrementor
                    ? this.parserCtx.expressionProcessor.visitNode(
                          forStatementNode.incrementor,
                      )
                    : null;
                const statement = this.visitNode(forStatementNode.statement)!;
                this.breakLabelsStack.pop();
                const forStatement = new ForStatement(
                    loopLabel,
                    blockLabel,
                    cond,
                    statement,
                    initializer,
                    incrementor,
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(forStatement, node);
                }
                forStatement.setScope(scope);

                /* current scope is outter block scope */
                scope.addStatement(forStatement);
                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.ForOfStatement: {
                const forOfStmtNode = <ts.ForOfStatement>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const loopLabel = 'for_loop_' + this.loopLabelStack.size();
                const breakLabels = this.breakLabelsStack;
                breakLabels.push(loopLabel + 'block');
                const blockLabel = breakLabels.peek();
                this.loopLabelStack.push(loopLabel);

                const forStatement = this.convertForOfToForLoop(
                    forOfStmtNode,
                    scope,
                    loopLabel,
                    blockLabel,
                );
                this.breakLabelsStack.pop();
                forStatement.setScope(scope);
                scope.addStatement(forStatement);
                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.ForInStatement: {
                const forInStmtNode = <ts.ForInStatement>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const loopLabel = 'for_loop_' + this.loopLabelStack.size();
                const breakLabels = this.breakLabelsStack;
                breakLabels.push(loopLabel + 'block');
                const blockLabel = breakLabels.peek();
                this.loopLabelStack.push(loopLabel);
                const forStatement = this.convertForInToForLoop(
                    forInStmtNode,
                    scope,
                    loopLabel,
                    blockLabel,
                );
                this.breakLabelsStack.pop();
                forStatement.setScope(scope);
                scope.addStatement(forStatement);
                const block = new BlockStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(block, node);
                }
                block.setScope(scope);
                return block;
            }
            case ts.SyntaxKind.ExpressionStatement: {
                const exprStatement = <ts.ExpressionStatement>node;
                const exprStmt = new ExpressionStatement(
                    this.parserCtx.expressionProcessor.visitNode(
                        exprStatement.expression,
                    ),
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(exprStmt, node);
                }
                return exprStmt;
            }
            case ts.SyntaxKind.EmptyStatement: {
                const emptyStmt = new EmptyStatement();
                if (this.emitSourceMap) {
                    addSourceMapLoc(emptyStmt, node);
                }
                return emptyStmt;
            }
            case ts.SyntaxKind.SwitchStatement: {
                const switchStatementNode = <ts.SwitchStatement>node;
                const switchLabels = this.switchLabelStack;
                switchLabels.push(switchLabels.size());
                const breakLabels = this.breakLabelsStack;
                breakLabels.push('break-switch-' + switchLabels.size());
                const expr = this.parserCtx.expressionProcessor.visitNode(
                    switchStatementNode.expression,
                );
                const caseBlock = this.visitNode(
                    switchStatementNode.caseBlock,
                )!;
                switchLabels.pop();
                breakLabels.pop();
                const swicthStmt = new SwitchStatement(expr, caseBlock);
                if (this.emitSourceMap) {
                    addSourceMapLoc(swicthStmt, node);
                }
                return swicthStmt;
            }
            case ts.SyntaxKind.CaseBlock: {
                const caseBlockNode = <ts.CaseBlock>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const breakLabelsStack = this.breakLabelsStack;
                const switchLabels = this.switchLabelStack;
                const switchLabel = '_' + switchLabels.peek().toString();

                const clauses = new Array<Statement>();
                for (let i = 0; i !== caseBlockNode.clauses.length; ++i) {
                    clauses.push(this.visitNode(caseBlockNode.clauses[i])!);
                }
                const caseBlock = new CaseBlock(
                    switchLabel,
                    breakLabelsStack.peek(),
                    clauses,
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(caseBlock, node);
                }
                caseBlock.setScope(scope);
                return caseBlock;
            }
            case ts.SyntaxKind.CaseClause: {
                const caseClauseNode = <ts.CaseClause>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const expr = this.parserCtx.expressionProcessor.visitNode(
                    caseClauseNode.expression,
                );
                const statements = new Array<Statement>();
                const caseStatements = caseClauseNode.statements;
                for (let i = 0; i != caseStatements.length; ++i) {
                    statements.push(this.visitNode(caseStatements[i])!);
                }
                const caseCause = new CaseClause(expr, statements);
                if (this.emitSourceMap) {
                    addSourceMapLoc(caseCause, node);
                }
                caseCause.setScope(scope);
                return caseCause;
            }
            case ts.SyntaxKind.DefaultClause: {
                const defaultClauseNode = <ts.DefaultClause>node;
                this.currentScope = this.parserCtx.getScopeByNode(node)!;
                const scope = this.currentScope;
                const statements = new Array<Statement>();
                const caseStatements = defaultClauseNode.statements;
                for (let i = 0; i != caseStatements.length; ++i) {
                    statements.push(this.visitNode(caseStatements[i])!);
                }
                const defaultClause = new DefaultClause(statements);
                if (this.emitSourceMap) {
                    addSourceMapLoc(defaultClause, node);
                }
                defaultClause.setScope(scope);
                return defaultClause;
            }
            case ts.SyntaxKind.BreakStatement: {
                const breakStatementNode = <ts.BreakStatement>node;
                assert(!breakStatementNode.label, 'not support goto');
                const breakStmt = new BreakStatement(
                    this.breakLabelsStack.peek(),
                );
                if (this.emitSourceMap) {
                    addSourceMapLoc(breakStmt, node);
                }
                return breakStmt;
            }
            case ts.SyntaxKind.FunctionDeclaration: {
                const funcScope = getCurScope(
                    node,
                    this.parserCtx.nodeScopeMap,
                ) as FunctionScope;
                const funcDeclStmt = new FunctionDeclarationStatement(
                    funcScope,
                );
                const rootFuncScope = funcScope.getRootFunctionScope();
                if (rootFuncScope && rootFuncScope !== funcScope) {
                    const tmpVar = new Variable(
                        funcScope.getName(),
                        funcScope.funcType,
                        [ModifierKind.const],
                        -1,
                        false,
                        this.parserCtx.expressionProcessor.visitNode(node),
                    );
                    funcScope.parent!.addVariable(tmpVar);
                    funcDeclStmt.tmpVar = tmpVar;
                }
                return funcDeclStmt;
            }
            case ts.SyntaxKind.ModuleDeclaration: {
                const md = <ts.ModuleDeclaration>node;
                const moduleBlock = <ts.ModuleBlock>md.body!;
                const scope = this.parserCtx.nodeScopeMap.get(moduleBlock);
                if (!scope) {
                    throw new StatementError(
                        `failed to find scope for ModuleDeclaration ${md.name}`,
                    );
                }
                return new ModDeclStatement(scope);
            }
            case ts.SyntaxKind.ThrowStatement: {
                const throwStmtNode = <ts.ThrowStatement>node;
                const expr = this.parserCtx.expressionProcessor.visitNode(
                    throwStmtNode.expression,
                );
                const throwStmt = new ThrowStatement(expr);
                return throwStmt;
            }
            case ts.SyntaxKind.CatchClause: {
                const catchClauseNode = <ts.CatchClause>node;
                const catchBlockStmt = this.visitNode(catchClauseNode.block)!;
                const catchClauseStmt = new CatchClauseStatement(
                    catchBlockStmt,
                );
                if (catchClauseNode.variableDeclaration) {
                    const varDecNode = <ts.VariableDeclaration>(
                        catchClauseNode.variableDeclaration
                    );
                    const catchVarName = varDecNode.getText();
                    catchClauseStmt.catchVar = new IdentifierExpression(
                        catchVarName,
                    );
                }
                return catchClauseStmt;
            }
            case ts.SyntaxKind.TryStatement: {
                const tryNode = <ts.TryStatement>node;
                const trySize = this.tryLabelStack.size();
                this.tryLabelStack.push(trySize);
                const tryBlockStmt = this.visitNode(tryNode.tryBlock)!;
                const tryLable = 'try_' + trySize;
                const tryStmt = new TryStatement(tryLable, tryBlockStmt);
                if (tryNode.catchClause) {
                    const catchClauseStmt = this.visitNode(
                        tryNode.catchClause,
                    )! as CatchClauseStatement;
                    tryStmt.catchClauseStmt = catchClauseStmt;
                }
                if (tryNode.finallyBlock) {
                    const finallyBlockStmt = this.visitNode(
                        tryNode.finallyBlock,
                    )! as BlockStatement;
                    tryStmt.finallyBlockStmt = finallyBlockStmt;
                }
                return tryStmt;
            }
            default:
                Logger.info(
                    `Encounter unprocessed statements, kind: [${
                        ts.SyntaxKind[node.kind]
                    }]`,
                );
                break;
        }

        return null;
    }

    addVariableInVarStmt(
        varDeclarationList: ts.VariableDeclarationList,
        varStatement: VariableStatement,
        currentScope: Scope,
        isDefinedInInitializer = false,
    ) {
        for (const varDeclaration of varDeclarationList.declarations) {
            const varDecNode = <ts.VariableDeclaration>varDeclaration;
            const varName = (<ts.Identifier>varDecNode.name).getText()!;
            const variable = this.currentScope!.findVariable(varName);
            if (!variable) {
                throw new StatementError(
                    'can not find ' + varName + ' in current scope',
                );
            }
            variable.needReBinding =
                isDefinedInInitializer && !variable.isFuncScopedVar();
            varStatement.addVariable(variable);
            if (variable.isFuncScopedVar() && varDecNode.initializer) {
                const identifierExpr = new IdentifierExpression(varName);
                identifierExpr.setExprType(variable.varType);
                const initExpr = this.parserCtx.expressionProcessor.visitNode(
                    varDecNode.initializer,
                );
                const assignExpr = new BinaryExpression(
                    ts.SyntaxKind.EqualsToken,
                    identifierExpr,
                    initExpr,
                );
                assignExpr.setExprType(variable.varType);
                const expressionStmt = new ExpressionStatement(assignExpr);
                if (this.emitSourceMap) {
                    addSourceMapLoc(expressionStmt, varDecNode);
                    addSourceMapLoc(initExpr, varDecNode.initializer);
                }
                currentScope.addStatement(expressionStmt);
            }
        }
    }

    createFieldAssignStmt(
        initializer: ts.Node,
        classType: TSClass,
        fieldType: Type,
        fieldName: string,
    ): Statement {
        const thisExpr = new IdentifierExpression('this');
        thisExpr.setExprType(classType);
        const fieldExpr = new IdentifierExpression(fieldName);
        fieldExpr.setExprType(fieldType);
        const propAccessExpr = new PropertyAccessExpression(
            thisExpr,
            fieldExpr,
        );
        propAccessExpr.setExprType(fieldType);
        const initExpr =
            this.parserCtx.expressionProcessor.visitNode(initializer);
        const assignExpr = new BinaryExpression(
            ts.SyntaxKind.EqualsToken,
            propAccessExpr,
            initExpr,
        );
        assignExpr.setExprType(fieldType);
        return new ExpressionStatement(assignExpr);
    }

    private convertForOfToForLoop(
        forOfStmtNode: ts.ForOfStatement,
        scope: Scope,
        loopLabel: string,
        blockLabel: string,
    ): Statement {
        let elementExpr: IdentifierExpression;
        const forOfInitializer = forOfStmtNode.initializer;
        if (ts.isVariableDeclarationList(forOfInitializer)) {
            elementExpr = this.parserCtx.expressionProcessor.visitNode(
                forOfInitializer.declarations[0].name,
            ) as IdentifierExpression;
        } else {
            // ts.Identifier
            elementExpr = this.parserCtx.expressionProcessor.visitNode(
                forOfInitializer,
            ) as IdentifierExpression;
        }

        const expr = this.parserCtx.expressionProcessor.visitNode(
            forOfStmtNode.expression,
        );

        const isStaticExpr =
            expr.exprType.kind === TypeKind.STRING ||
            expr.exprType.kind === TypeKind.ARRAY;

        const loopIndexLabel = `@loop_index`;
        const lastIndexLabel = `@last_index`;
        const iteratorLabel = `@loop_next_iter`;

        const numberType = builtinTypes.get('number')!;
        const booleanType = builtinTypes.get('boolean')!;
        const anyType = builtinTypes.get('any')!;

        const indexExpr = new IdentifierExpression(loopIndexLabel);
        const iterExpr = new IdentifierExpression(iteratorLabel);
        let initializer: Statement;
        let cond: Expression;
        let incrementor: Expression;

        // TODO: use i32 for index
        if (isStaticExpr) {
            const loopIndex = new Variable(loopIndexLabel, numberType);
            const lastIndex = new Variable(lastIndexLabel, numberType);
            scope.addVariable(loopIndex);
            scope.addVariable(lastIndex);

            // const indexExpr = new IdentifierExpression(loopIndexLabel);
            indexExpr.setExprType(loopIndex.varType);
            const lastExpr = new IdentifierExpression(lastIndexLabel);
            lastExpr.setExprType(lastIndex.varType);

            const indexInitExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                indexExpr,
                new NumberLiteralExpression(0),
            );
            indexInitExpr.setExprType(loopIndex.varType);

            const exprPropExpr = new IdentifierExpression('length');
            exprPropExpr.setExprType(numberType);
            const propAccessExpr = new PropertyAccessExpression(
                expr,
                exprPropExpr,
            );
            propAccessExpr.setExprType(numberType);

            const lastIndexInitExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                lastExpr,
                propAccessExpr,
            );
            lastIndexInitExpr.setExprType(lastIndex.varType);
            scope.addStatement(new ExpressionStatement(lastIndexInitExpr));

            initializer = new ExpressionStatement(indexInitExpr);
            cond = new BinaryExpression(
                ts.SyntaxKind.LessThanToken,
                indexExpr,
                lastExpr,
            );
            cond.setExprType(booleanType);
            incrementor = new UnaryExpression(
                ts.SyntaxKind.PostfixUnaryExpression,
                ts.SyntaxKind.PlusPlusToken,
                indexExpr,
            );
            incrementor.setExprType(numberType);
        } else {
            const loopIter = new Variable(iteratorLabel, anyType);
            scope.addVariable(loopIter);
            // const iterExpr = new IdentifierExpression(iteratorLabel);
            iterExpr.setExprType(loopIter.varType);

            // for dynamic array, should get its iterator firstly
            const tempIter = new Variable('@temp_iter', anyType);
            scope.addVariable(tempIter);
            const tempIterExpr = new IdentifierExpression('@temp_iter');
            tempIterExpr.setExprType(tempIter.varType);

            // tempIter = expr.value();
            const valueExpr = new IdentifierExpression('values');
            valueExpr.setExprType(anyType);
            const valueAccessExpr = new PropertyAccessExpression(
                expr,
                valueExpr,
            );
            valueAccessExpr.setExprType(anyType);
            const valueCallExpr = new CallExpression(valueAccessExpr);
            valueCallExpr.setExprType(anyType);

            const lengthPropExpr = new IdentifierExpression('length');
            lengthPropExpr.setExprType(anyType);
            const lengthAccessExpr = new PropertyAccessExpression(
                expr,
                lengthPropExpr,
            );
            lengthAccessExpr.setExprType(anyType);
            const isArray = new BinaryExpression(
                ts.SyntaxKind.ExclamationEqualsEqualsToken,
                lengthAccessExpr,
                new UndefinedKeywordExpression(),
            );
            isArray.rightOperand.setExprType(anyType);
            isArray.setExprType(booleanType);

            // if isArray is true, assign expr.values() to tempIter
            const assignForArrayExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                tempIterExpr,
                valueCallExpr,
            );
            assignForArrayExpr.setExprType(anyType);
            // if isArray is false, assign expr to tempIter
            const assignForNonArrayExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                tempIterExpr,
                expr,
            );
            assignForNonArrayExpr.setExprType(anyType);
            const ifStmt = new IfStatement(
                isArray,
                new ExpressionStatement(assignForArrayExpr),
                new ExpressionStatement(assignForNonArrayExpr),
            );
            scope.addStatement(ifStmt);

            const nextExpr = new IdentifierExpression('next');
            nextExpr.setExprType(anyType);
            const iterNextExpr = new PropertyAccessExpression(
                tempIterExpr,
                nextExpr,
            );
            iterNextExpr.setExprType(anyType);
            const callIterNextExpr = new CallExpression(iterNextExpr);
            callIterNextExpr.setExprType(anyType);

            const doneExpr = new IdentifierExpression('done');
            doneExpr.setExprType(anyType);
            const iterDoneExpr = new PropertyAccessExpression(
                iterExpr,
                doneExpr,
            );
            const initExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                iterExpr,
                callIterNextExpr,
            );
            initExpr.setExprType(anyType);
            initializer = new ExpressionStatement(initExpr);
            cond = new UnaryExpression(
                ts.SyntaxKind.PrefixUnaryExpression,
                ts.SyntaxKind.ExclamationToken,
                iterDoneExpr,
            );
            cond.setExprType(booleanType);
            incrementor = initExpr;
        }

        let statement = this.visitNode(forOfStmtNode.statement)!;
        if (!(statement instanceof BlockStatement)) {
            const blockScope = new Scope(scope);
            blockScope.statements.push(statement);
            statement = new BlockStatement();
            statement.setScope(blockScope);
        }
        const scopeStmts = statement.getScope()!.statements;
        if (isStaticExpr) {
            const elemAccessExpr = new ElementAccessExpression(expr, indexExpr);
            elemAccessExpr.setExprType(elementExpr.exprType);
            const elemAssignmentExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                elementExpr,
                elemAccessExpr,
            );
            elemAssignmentExpr.setExprType(elementExpr.exprType);
            scopeStmts.unshift(new ExpressionStatement(elemAssignmentExpr));
        } else {
            const valueExpr = new IdentifierExpression('value');
            valueExpr.setExprType(anyType);
            const valueAccessExpr = new PropertyAccessExpression(
                iterExpr,
                valueExpr,
            );
            valueAccessExpr.setExprType(anyType);
            const valueAssignExpr = new BinaryExpression(
                ts.SyntaxKind.EqualsToken,
                elementExpr,
                valueAccessExpr,
            );
            valueAssignExpr.setExprType(elementExpr.exprType);
            scopeStmts.unshift(new ExpressionStatement(valueAssignExpr));
        }
        const forStatement = new ForStatement(
            loopLabel,
            blockLabel,
            cond,
            statement,
            initializer,
            incrementor,
        );
        return forStatement;
    }

    private convertForInToForLoop(
        forInStmtNode: ts.ForInStatement,
        scope: Scope,
        loopLabel: string,
        blockLabel: string,
    ) {
        const propNameLabel = `@prop_name_arr`;
        const propNameArrExpr = new IdentifierExpression(propNameLabel);
        let elementExpr: IdentifierExpression;
        const forInInitializer = forInStmtNode.initializer;
        if (ts.isVariableDeclarationList(forInInitializer)) {
            elementExpr = this.parserCtx.expressionProcessor.visitNode(
                forInInitializer.declarations[0].name,
            ) as IdentifierExpression;
        } else {
            elementExpr = this.parserCtx.expressionProcessor.visitNode(
                forInInitializer,
            ) as IdentifierExpression;
        }

        const expr = this.parserCtx.expressionProcessor.visitNode(
            forInStmtNode.expression,
        );
        const exprType = expr.exprType;

        /* the prop names array set `any` as its default type */
        let propNamesArrType = builtinTypes.get('any')!;
        let getKeysExpr: Expression | undefined = undefined;
        if (
            exprType.kind === TypeKind.CLASS ||
            exprType.kind === TypeKind.INTERFACE
        ) {
            /* For class/interface, prop names array's type is Array(string) */
            propNamesArrType = new TSArray(builtinTypes.get('string')!);
            if (exprType.kind === TypeKind.CLASS) {
                /* If expr has class type, its property name can be got in compile time */
                getKeysExpr = new ArrayLiteralExpression(
                    this.getClassIterPropNames(exprType as TSClass),
                );
            } else if (exprType.kind === TypeKind.INTERFACE) {
                /* If expr has interface type, its property name should be got during runtime */
                getKeysExpr = new EnumerateKeysExpression(expr);
            }
        } else if (exprType.kind === TypeKind.ANY) {
            propNamesArrType = builtinTypes.get('any')!;
            /* If expr has interface type, its property name should be got during runtime */
            getKeysExpr = new EnumerateKeysExpression(expr);
        }
        if (!getKeysExpr) {
            throw new UnimplementError(
                `${exprType.kind} has not been supported in for in statement`,
            );
        }
        /* insert temp array var to store property names */
        const propNameArr = new Variable(propNameLabel, propNamesArrType);
        scope.addVariable(propNameArr);
        propNameArrExpr.setExprType(propNamesArrType);
        getKeysExpr.setExprType(propNamesArrType);
        const arrAssignExpr = new BinaryExpression(
            ts.SyntaxKind.EqualsToken,
            propNameArrExpr,
            getKeysExpr,
        );
        arrAssignExpr.setExprType(propNamesArrType);
        scope.addStatement(new ExpressionStatement(arrAssignExpr));

        const numberType = builtinTypes.get('number')!;
        const exprPropExpr = new IdentifierExpression('length');
        exprPropExpr.setExprType(numberType);
        const propAccessExpr = new PropertyAccessExpression(
            propNameArrExpr,
            exprPropExpr,
        );
        propAccessExpr.setExprType(numberType);

        const loopIndexLabel = `@loop_index`;
        const lastIndexLabel = `@last_index`;
        const loopIndex = new Variable(loopIndexLabel, numberType);
        const lastIndex = new Variable(lastIndexLabel, numberType);
        scope.addVariable(loopIndex);
        scope.addVariable(lastIndex);
        const indexExpr = new IdentifierExpression(loopIndexLabel);
        indexExpr.setExprType(loopIndex.varType);
        const lastExpr = new IdentifierExpression(lastIndexLabel);
        lastExpr.setExprType(lastIndex.varType);

        const indexInitExpr = new BinaryExpression(
            ts.SyntaxKind.EqualsToken,
            indexExpr,
            new NumberLiteralExpression(0),
        );
        indexInitExpr.setExprType(loopIndex.varType);

        const lastIndexInitExpr = new BinaryExpression(
            ts.SyntaxKind.EqualsToken,
            lastExpr,
            propAccessExpr,
        );
        lastIndexInitExpr.setExprType(lastIndex.varType);
        scope.addStatement(new ExpressionStatement(lastIndexInitExpr));

        const initializer = new ExpressionStatement(indexInitExpr);
        const cond = new BinaryExpression(
            ts.SyntaxKind.LessThanToken,
            indexExpr,
            lastExpr,
        );
        cond.setExprType(numberType);
        const incrementor = new UnaryExpression(
            ts.SyntaxKind.PostfixUnaryExpression,
            ts.SyntaxKind.PlusPlusToken,
            indexExpr,
        );
        incrementor.setExprType(numberType);

        let statement = this.visitNode(forInStmtNode.statement)!;
        if (!(statement instanceof BlockStatement)) {
            const blockScope = new Scope(scope);
            blockScope.statements.push(statement);
            statement = new BlockStatement();
            statement.setScope(blockScope);
        }
        const scopeStmts = statement.getScope()!.statements;
        const elemAccessExpr = new ElementAccessExpression(
            propNameArrExpr,
            indexExpr,
        );
        elemAccessExpr.setExprType(elementExpr.exprType);
        const elemAssignmentExpr = new BinaryExpression(
            ts.SyntaxKind.EqualsToken,
            elementExpr,
            elemAccessExpr,
        );
        elemAssignmentExpr.setExprType(elementExpr.exprType);

        scopeStmts.unshift(new ExpressionStatement(elemAssignmentExpr));

        return new ForStatement(
            loopLabel,
            blockLabel,
            cond,
            statement,
            initializer,
            incrementor,
        );
    }

    /** it uses for for in loop, to stores property names in compile time */
    private getClassIterPropNames(classType: TSClass): Expression[] {
        const memberFields = classType.fields;
        return memberFields.map((field) => {
            const strLiteralExpr = new StringLiteralExpression(field.name);
            strLiteralExpr.setExprType(builtinTypes.get('string')!);
            return strLiteralExpr;
        });
    }
}
