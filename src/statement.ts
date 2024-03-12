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
import { Scope, ScopeKind, FunctionScope, BlockScope } from './scope.js';
import {
    parentIsFunctionLike,
    Stack,
    getModulePath,
    getGlobalScopeByModuleName,
    SourceLocation,
    addSourceMapLoc,
    getCurScope,
    processGenericType,
} from './utils.js';
import { ModifierKind, Variable, Parameter } from './variable.js';
import {
    TSArray,
    TSClass,
    Type,
    TypeKind,
    builtinTypes,
    TSTypeParameter,
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

    clone() {
        const stmt = new Statement(this.statementKind);
        return stmt;
    }
}

/** in order to keep order of namespace in parent level scope, creat a corresponding statement
 * for namespace
 */
export class ModDeclStatement extends Statement {
    constructor(public scope: Scope) {
        super(ts.SyntaxKind.ModuleDeclaration);
    }

    clone(): ModDeclStatement {
        const stmt = new ModDeclStatement(this.scope);
        return stmt;
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

    clone(): IfStatement {
        const stmt = new IfStatement(
            this.ifCondition,
            this.ifIfTrue,
            this.ifIfFalse,
        );
        return stmt;
    }
}

export class BlockStatement extends Statement {
    constructor() {
        super(ts.SyntaxKind.Block);
    }

    clone(): BlockStatement {
        const stmt = new BlockStatement();
        const scope = this.getScope();
        if (scope !== null) stmt.setScope(scope);
        return stmt;
    }
}

export class ReturnStatement extends Statement {
    constructor(private expr: Expression | null) {
        super(ts.SyntaxKind.ReturnStatement);
    }

    get returnExpression(): Expression | null {
        return this.expr;
    }

    clone(): ReturnStatement {
        const stmt = new ReturnStatement(this.returnExpression);
        return stmt;
    }
}

// create 'while' or 'do...while' loop
export class BaseLoopStatement extends Statement {
    constructor(
        kind: StatementKind,
        private _loopLabel: string,
        private _blockLabel: string,
        private _continueLabel: string | null,
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

    get loopContinueLable(): string | null {
        return this._continueLabel;
    }

    get loopCondtion(): Expression {
        return this.cond;
    }

    get loopBody(): Statement {
        return this.body;
    }

    clone(): BaseLoopStatement {
        const stmt = new BaseLoopStatement(
            this.statementKind,
            this.loopLabel,
            this.loopBlockLabel,
            this.loopContinueLable,
            this.loopCondtion,
            this.loopBody,
        );
        return stmt;
    }
}

export class ForStatement extends Statement {
    constructor(
        private label: string,
        private blockLabel: string,
        private continueLabel: string | null,
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

    get forContinueLable(): string | null {
        return this.continueLabel;
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

    clone(): ForStatement {
        const stmt = new ForStatement(
            this.forLoopLabel,
            this.forLoopBlockLabel,
            this.forContinueLable,
            this.forLoopCondtion,
            this.forLoopBody,
            this.forLoopInitializer,
            this.forLoopIncrementor,
        );
        return stmt;
    }
}

export class ExpressionStatement extends Statement {
    constructor(private expr: Expression) {
        super(ts.SyntaxKind.ExpressionStatement);
    }

    get expression(): Expression {
        return this.expr;
    }

    clone(): ExpressionStatement {
        const stmt = new ExpressionStatement(this.expression);
        return stmt;
    }
}

export class EmptyStatement extends Statement {
    constructor() {
        super(ts.SyntaxKind.EmptyStatement);
    }

    clone(): EmptyStatement {
        const stmt = new EmptyStatement();
        return stmt;
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

    clone(): CaseClause {
        const stmt = new CaseClause(this.caseExpr, this.caseStatements);
        return stmt;
    }
}

export class DefaultClause extends Statement {
    constructor(private statements: Statement[]) {
        super(ts.SyntaxKind.DefaultClause);
    }

    get caseStatements(): Statement[] {
        return this.statements;
    }

    clone(): DefaultClause {
        const stmt = new DefaultClause(this.caseStatements);
        return stmt;
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

    clone(): CaseBlock {
        const stmt = new CaseBlock(
            this.switchLabel,
            this.breakLabel,
            this.caseCauses,
        );
        return stmt;
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

    clone(): SwitchStatement {
        const stmt = new SwitchStatement(
            this.switchCondition,
            this.switchCaseBlock,
        );
        return stmt;
    }
}

export class BreakStatement extends Statement {
    constructor(private label: string) {
        super(ts.SyntaxKind.BreakStatement);
    }

    get breakLabel(): string {
        return this.label;
    }

    clone(): BreakStatement {
        const stmt = new BreakStatement(this.breakLabel);
        return stmt;
    }
}

export class ContinueStatement extends Statement {
    constructor(private label: string) {
        super(ts.SyntaxKind.ContinueStatement);
    }

    get continueLabel(): string {
        return this.label;
    }

    clone(): ContinueStatement {
        const stmt = new ContinueStatement(this.continueLabel);
        return stmt;
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

    clone(): FunctionDeclarationStatement {
        const stmt = new FunctionDeclarationStatement(this.funcScope);
        return stmt;
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

    clone(): VariableStatement {
        const stmt = new VariableStatement();
        this.varArray.forEach((v) => {
            stmt.addVariable(v);
        });
        return stmt;
    }
}

export class ImportDeclaration extends Statement {
    importModuleStartFuncName = '';

    constructor() {
        super(ts.SyntaxKind.ImportDeclaration);
    }

    clone(): ImportDeclaration {
        const stmt = new ImportDeclaration();
        return stmt;
    }
}

export class ThrowStatement extends Statement {
    expr: Expression;

    constructor(expr: Expression) {
        super(ts.SyntaxKind.ThrowStatement);
        this.expr = expr;
    }

    clone(): ThrowStatement {
        const stmt = new ThrowStatement(this.expr);
        return stmt;
    }
}

export class CatchClauseStatement extends Statement {
    catchBlockStmt: BlockStatement;
    catchVar: IdentifierExpression | undefined = undefined;

    constructor(catchBlock: BlockStatement) {
        super(ts.SyntaxKind.CatchClause);
        this.catchBlockStmt = catchBlock;
    }

    clone(): CatchClauseStatement {
        const stmt = new CatchClauseStatement(this.catchBlockStmt);
        stmt.catchVar = this.catchVar;
        return stmt;
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

    clone(): TryStatement {
        const stmt = new TryStatement(this.label, this.tryBlockStmt);
        stmt.catchClauseStmt = this.catchClauseStmt;
        stmt.finallyBlockStmt = this.finallyBlockStmt;
        return stmt;
    }
}

export class StatementProcessor {
    private loopLabelStack = new Stack<string>();
    private breakLabelsStack = new Stack<string>();
    // mark if continue statement in a loop
    private continueFlagMap = new Set<string>();
    private switchLabelStack = new Stack<number>();
    private tryLabelStack = new Stack<number>();
    private currentScope: Scope | null = null;
    private emitSourceMap = false;

    constructor(private parserCtx: ParserContext) {}

    visit() {
        this.emitSourceMap = getConfig().sourceMap;
        this.parserCtx.nodeScopeMap.forEach((scope, node) => {
            this.parserCtx.currentScope = scope;
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
                const continueLabel = this.getLoopContinueLabel(loopLabel);
                this.loopLabelStack.push(loopLabel);

                const expr = this.parserCtx.expressionProcessor.visitNode(
                    whileStatementNode.expression,
                );
                const statement = this.visitNode(whileStatementNode.statement)!;
                this.breakLabelsStack.pop();
                this.loopLabelStack.pop();
                const loopStatment = new BaseLoopStatement(
                    ts.SyntaxKind.WhileStatement,
                    loopLabel,
                    blockLabel,
                    this.continueFlagMap.has(continueLabel)
                        ? continueLabel
                        : null,
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
                const continueLabel = this.getLoopContinueLabel(loopLabel);
                this.loopLabelStack.push(loopLabel);

                const expr = this.parserCtx.expressionProcessor.visitNode(
                    doWhileStatementNode.expression,
                );
                const statement = this.visitNode(
                    doWhileStatementNode.statement,
                )!;
                this.breakLabelsStack.pop();
                this.loopLabelStack.pop();
                const loopStatment = new BaseLoopStatement(
                    ts.SyntaxKind.DoStatement,
                    loopLabel,
                    blockLabel,
                    this.continueFlagMap.has(continueLabel)
                        ? continueLabel
                        : null,
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
                const continueLabel = this.getLoopContinueLabel(loopLabel);
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
                this.loopLabelStack.pop();
                const forStatement = new ForStatement(
                    loopLabel,
                    blockLabel,
                    this.continueFlagMap.has(continueLabel)
                        ? continueLabel
                        : null,
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
                const continueLabel = this.getLoopContinueLabel(loopLabel);
                this.loopLabelStack.push(loopLabel);

                const forStatement = this.convertForOfToForLoop(
                    forOfStmtNode,
                    scope,
                    loopLabel,
                    blockLabel,
                    continueLabel,
                );
                this.breakLabelsStack.pop();
                this.loopLabelStack.pop();
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
                const continueLabel = this.getLoopContinueLabel(loopLabel);
                this.loopLabelStack.push(loopLabel);
                const forStatement = this.convertForInToForLoop(
                    forInStmtNode,
                    scope,
                    loopLabel,
                    blockLabel,
                    continueLabel,
                );
                this.breakLabelsStack.pop();
                this.loopLabelStack.pop();
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
            case ts.SyntaxKind.ContinueStatement: {
                const label = this.getLoopContinueLabel(
                    this.loopLabelStack.peek(),
                );
                this.continueFlagMap.add(label);
                const continueStmt = new ContinueStatement(label);
                if (this.emitSourceMap) {
                    addSourceMapLoc(continueStmt, node);
                }
                return continueStmt;
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
        continueLabel: string,
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
            this.continueFlagMap.has(continueLabel) ? continueLabel : null,
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
        continueLabel: string,
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
            this.continueFlagMap.has(continueLabel) ? continueLabel : null,
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

    private getLoopContinueLabel(loopLabel: string): string {
        return loopLabel + '_continue';
    }
}

export class StatementSpecializationProcessor {
    currentScope: Scope | null = null;
    constructor(private parserCtx: ParserContext) {}

    visit() {
        for (const g of this.parserCtx.globalScopes) {
            this.currentScope = g;
            this.visitScope(g);
        }
    }

    visitScope(scope: Scope) {
        switch (scope.kind) {
            case ScopeKind.FunctionScope:
                this.currentScope = scope as FunctionScope;
                if (scope.genericOwner) {
                    const originalFuncType = (
                        scope.genericOwner as FunctionScope
                    ).funcType;
                    const typeParameters = originalFuncType.isMethod
                        ? originalFuncType.belongedClass!.typeArguments
                            ? originalFuncType.belongedClass!.typeArguments
                            : originalFuncType.typeArguments!
                        : originalFuncType.typeArguments!;
                    const specializedFuncType = (scope as FunctionScope)
                        .funcType;
                    const typeArguments = specializedFuncType.isMethod
                        ? specializedFuncType.belongedClass!
                              .specializedArguments
                            ? specializedFuncType.belongedClass!
                                  .specializedArguments
                            : specializedFuncType.specializedArguments!
                        : specializedFuncType.specializedArguments!;

                    const genericFunctionScope =
                        scope.genericOwner as FunctionScope;
                    //prcocess parameters and variables
                    genericFunctionScope.paramArray.forEach((v) => {
                        let varType = v.varType;
                        let initExpression = v.initExpression;
                        if (typeArguments) {
                            varType = processGenericType(
                                v.varType,
                                typeArguments,
                                typeParameters,
                                this.parserCtx,
                            );
                            initExpression = initExpression
                                ? this.parserCtx.expressionProcessor.specializeExpression(
                                      initExpression,
                                      typeArguments,
                                      typeParameters,
                                      scope,
                                  )
                                : initExpression;
                        }
                        const new_parameter = new Parameter(
                            v.varName,
                            varType,
                            v.varModifiers,
                            v.varIndex,
                            v.isOptional,
                            v.destructuring,
                            initExpression,
                            v.isLocalVar(),
                        );

                        if (v.varIsClosure) new_parameter.setVarIsClosure();
                        (scope as FunctionScope).addParameter(new_parameter);
                    });
                    genericFunctionScope.varArray.forEach((v, index) => {
                        if (v.varName == '@context') {
                            const contextVar = new Variable(
                                '@context',
                                v.varType,
                                v.varModifiers,
                                v.varIndex,
                                v.isLocalVar(),
                                v.initExpression,
                            );
                            contextVar.scope = scope;
                            (scope as FunctionScope).contextVariable =
                                contextVar;
                            scope.addVariable(contextVar);
                        } else if (v.varName == 'this') {
                            const thisVar = new Variable(
                                'this',
                                processGenericType(
                                    v.varType,
                                    typeArguments,
                                    typeParameters,
                                    this.parserCtx,
                                ),
                                v.varModifiers,
                                v.varIndex,
                                v.isLocalVar(),
                                v.initExpression,
                            );
                            thisVar.setVarIsClosure();
                            thisVar.scope = scope;
                            scope.addVariable(thisVar);
                        }
                    });

                    scope.genericOwner.statements.forEach((s) => {
                        const stmt = this.processStatement(
                            s,
                            typeArguments,
                            typeParameters,
                            this.currentScope!,
                        );
                        scope.addStatement(stmt);
                    });
                }
                break;
            default:
                this.foreachScopeChildren(scope);
                break;
        }
    }

    foreachScopeChildren(scope: Scope) {
        for (const c of scope.children) {
            this.currentScope = c;
            this.visitScope(c);
        }
    }

    processStatement(
        s: Statement,
        typeArguments: Type[],
        typeParameters: TSTypeParameter[],
        currentScope: Scope,
    ): Statement {
        const stmt = s.clone();
        switch (stmt.statementKind) {
            case ts.SyntaxKind.VariableStatement: {
                const variableStatement = stmt as VariableStatement;
                const newVariableStatement = new VariableStatement();
                variableStatement.varArray.forEach((v) => {
                    const initExpression = v.initExpression;
                    if (!initExpression) {
                        newVariableStatement.addVariable(v);
                    } else {
                        const newInitExpression =
                            this.parserCtx.expressionProcessor.specializeExpression(
                                initExpression,
                                typeArguments,
                                typeParameters,
                                currentScope,
                            );
                        const newVar = new Variable(
                            v.varName,
                            newInitExpression.exprType,
                            v.varModifiers,
                            v.varIndex,
                            v.isLocalVar(),
                            newInitExpression,
                        );
                        if (v.varIsClosure) newVar.setVarIsClosure();
                        newVariableStatement.addVariable(newVar);
                        currentScope.addVariable(newVar);
                        newVar.scope = currentScope;
                    }
                });
                return newVariableStatement;
            }
            case ts.SyntaxKind.IfStatement: {
                const ifStatement = stmt as IfStatement;
                const newIfCondition =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        ifStatement.ifCondition,
                        typeArguments,
                        typeParameters,
                        this.currentScope! as FunctionScope,
                    );
                const newIfTrue = this.processStatement(
                    ifStatement.ifIfTrue,
                    typeArguments,
                    typeParameters,
                    currentScope,
                );
                let newIfFalse: Statement | null = null;
                if (ifStatement.ifIfFalse) {
                    newIfFalse = this.processStatement(
                        ifStatement.ifIfFalse,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                }
                const newIfStatement = new IfStatement(
                    newIfCondition,
                    newIfTrue,
                    newIfFalse,
                );
                return newIfStatement;
            }
            case ts.SyntaxKind.Block: {
                const blockStatement = stmt as BlockStatement;
                const newBlockStatement = new BlockStatement();
                if (blockStatement.getScope() !== null) {
                    const genericBlockScope =
                        blockStatement.getScope() as BlockScope;
                    const newBlockScope = new BlockScope(
                        currentScope,
                        genericBlockScope.getName(),
                        this.currentScope as FunctionScope,
                    );
                    genericBlockScope.specialize(newBlockScope);
                    // initialize the properties of BlockScope;
                    newBlockScope.setGenericOwner(genericBlockScope);
                    genericBlockScope.addSpecializedScope(
                        genericBlockScope.getName(),
                        newBlockScope,
                    );
                    if (genericBlockScope.mangledName !== '') {
                        newBlockScope.mangledName =
                            currentScope.mangledName !== ''
                                ? currentScope.mangledName +
                                  '|' +
                                  newBlockScope.getName()
                                : newBlockScope.getName();
                    }

                    //process variable '@context'
                    genericBlockScope.varArray.forEach((v) => {
                        if (v.varName == '@context') {
                            const contextVar = new Variable(
                                '@context',
                                v.varType,
                                v.varModifiers,
                                v.varIndex,
                                v.isLocalVar(),
                                v.initExpression,
                            );
                            contextVar.scope = newBlockScope;
                            newBlockScope.addVariable(contextVar);
                        }
                    });

                    // processing statement
                    genericBlockScope.statements.forEach((s) => {
                        const newStmt = this.processStatement(
                            s,
                            typeArguments,
                            typeParameters,
                            newBlockScope,
                        );
                        newBlockScope.addStatement(newStmt);
                    });
                    newBlockStatement.setScope(newBlockScope);
                }

                return newBlockStatement;
            }
            case ts.SyntaxKind.ReturnStatement: {
                const returnStatement = stmt as ReturnStatement;
                if (!returnStatement.returnExpression) return returnStatement;
                const returnExpression =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        returnStatement.returnExpression,
                        typeArguments,
                        typeParameters,
                        this.currentScope! as FunctionScope,
                    );
                const newReturnStatement = new ReturnStatement(
                    returnExpression,
                );
                return newReturnStatement;
            }
            case ts.SyntaxKind.WhileStatement: {
                const baseLoopStatement = stmt as BaseLoopStatement;
                const newLoopLabel = baseLoopStatement.loopLabel;
                const newBlockLabel = baseLoopStatement.loopBlockLabel;
                const newContinueLable = baseLoopStatement.loopContinueLable;
                const newLoopCondtion =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        baseLoopStatement.loopCondtion,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                const newLoopBody = this.processStatement(
                    baseLoopStatement.loopBody,
                    typeArguments,
                    typeParameters,
                    currentScope,
                );
                const newBaseLoopStatement = new BaseLoopStatement(
                    baseLoopStatement.statementKind,
                    newLoopLabel,
                    newBlockLabel,
                    newContinueLable,
                    newLoopCondtion,
                    newLoopBody,
                );
                return newBaseLoopStatement;
            }
            case ts.SyntaxKind.ExpressionStatement: {
                const expressionStatement = stmt as ExpressionStatement;
                const expression =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        expressionStatement.expression,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                const newExpressionStatement = new ExpressionStatement(
                    expression,
                );
                return newExpressionStatement;
            }
            case ts.SyntaxKind.SwitchStatement: {
                const switchStatement = stmt as SwitchStatement;
                const newSwitchCondition =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        switchStatement.switchCondition,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                const newSwitchCaseBlock = this.processStatement(
                    switchStatement.switchCaseBlock,
                    typeArguments,
                    typeParameters,
                    currentScope,
                );
                const newSwitchStatement = new SwitchStatement(
                    newSwitchCondition,
                    newSwitchCaseBlock,
                );
                return newSwitchStatement;
            }
            case ts.SyntaxKind.CaseBlock: {
                const caseBlock = stmt as CaseBlock;
                const newSwitchLabel = caseBlock.switchLabel;
                const newBreakLabel = caseBlock.breakLabel;
                const stmtArray: Statement[] = [];
                caseBlock.caseCauses.forEach((s) => {
                    const newStmt = this.processStatement(
                        s,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                    stmtArray.push(newStmt);
                });
                const newCaseBlock = new CaseBlock(
                    newSwitchLabel,
                    newBreakLabel,
                    stmtArray,
                );
                return newCaseBlock;
            }
            case ts.SyntaxKind.CaseClause: {
                const caseClause = stmt as CaseClause;
                const newCaseExpr =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        caseClause.caseExpr,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                const stmtArray: Statement[] = [];
                caseClause.caseStatements.forEach((s) => {
                    const newStmt = this.processStatement(
                        s,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                    stmtArray.push(newStmt);
                });
                const newCaseClause = new CaseClause(newCaseExpr, stmtArray);
                return newCaseClause;
            }
            case ts.SyntaxKind.DefaultClause: {
                const defaultClause = stmt as DefaultClause;
                const stmtArray: Statement[] = [];
                defaultClause.caseStatements.forEach((s) => {
                    const newStmt = this.processStatement(
                        s,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                    stmtArray.push(newStmt);
                });
                const newDefaultClause = new DefaultClause(stmtArray);
                return newDefaultClause;
            }
            case ts.SyntaxKind.ThrowStatement: {
                const throwStatement = stmt as ThrowStatement;
                const newExpr =
                    this.parserCtx.expressionProcessor.specializeExpression(
                        throwStatement.expr,
                        typeArguments,
                        typeParameters,
                        currentScope,
                    );
                const newThrowStatement = new ThrowStatement(newExpr);
                return newThrowStatement;
            }
            case ts.SyntaxKind.CatchClause: {
                const catchClauseStatement = stmt as CatchClauseStatement;
                const newCatchBlockStmt = this.processStatement(
                    catchClauseStatement.catchBlockStmt,
                    typeArguments,
                    typeParameters,
                    currentScope,
                ) as BlockStatement;
                const newCatchClauseStatement = new CatchClauseStatement(
                    newCatchBlockStmt,
                );
                return newCatchClauseStatement;
            }
            case ts.SyntaxKind.TryStatement: {
                const tryStatement = stmt as TryStatement;
                const newLable = tryStatement.label;
                const newTryBlockStmt = this.processStatement(
                    tryStatement.tryBlockStmt,
                    typeArguments,
                    typeParameters,
                    currentScope,
                ) as BlockStatement;
                const newTryStatement = new TryStatement(
                    newLable,
                    newTryBlockStmt,
                );
                return newTryStatement;
            }
            default:
                return stmt;
        }
    }
}
