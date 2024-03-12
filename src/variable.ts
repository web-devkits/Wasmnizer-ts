/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import { Expression, IdentifierExpression } from './expression.js';
import { TypeResolver, Type, TypeKind, TSEnum } from './type.js';
import { ParserContext } from './frontend.js';
import {
    addSourceMapLoc,
    generateNodeExpression,
    isScopeNode,
} from './utils.js';
import { FunctionScope, GlobalScope, Scope } from './scope.js';
import { getConfig } from '../config/config_mgr.js';

export enum ModifierKind {
    default = '',
    const = 'const',
    let = 'let',
    var = 'var',
}
export class Variable {
    private _isClosure = false;
    public mangledName = '';
    public scope: Scope | null = null;
    /* If variable is a closure variable, we should record which context it belongs to and its closureIdx */
    public belongCtx?: Variable;
    public closureIndex?: number;
    /* If variable is a closure context, we should record its init context to do initialize */
    public initContext?: Variable;
    public tsNode?: ts.Node;
    public needReBinding = false;

    constructor(
        private name: string,
        private type: Type,
        private modifiers: (ModifierKind | ts.SyntaxKind)[] = [],
        private index = -1,
        private isLocal = true,
        private init: Expression | null = null,
    ) {}

    get varName(): string {
        return this.name;
    }

    set varType(type: Type) {
        this.type = type;
    }

    get varType(): Type {
        return this.type;
    }

    get varModifiers(): (ModifierKind | ts.SyntaxKind)[] {
        return this.modifiers;
    }

    public isConst(): boolean {
        return this.modifiers.includes(ModifierKind.const);
    }

    public isReadOnly(): boolean {
        return this.modifiers.includes(ts.SyntaxKind.ReadonlyKeyword);
    }

    public isDeclare(): boolean {
        let res = false;
        if (this.modifiers.includes(ts.SyntaxKind.DeclareKeyword)) {
            res = true;
            return res;
        }
        return this.scope?.isDeclare() || false;
    }

    public isExport(): boolean {
        return this.modifiers.includes(ts.SyntaxKind.ExportKeyword);
    }

    public isDefault(): boolean {
        return this.modifiers.includes(ts.SyntaxKind.DefaultKeyword);
    }

    public isFuncScopedVar(): boolean {
        return this.modifiers.includes(ModifierKind.var);
    }

    public setInitExpr(expr: Expression) {
        this.init = expr;
    }

    get initExpression(): Expression | null {
        return this.init;
    }

    get varIsClosure(): boolean {
        return this._isClosure;
    }

    public setVarIndex(varIndex: number) {
        this.index = varIndex;
    }

    get varIndex(): number {
        return this.index;
    }

    public isLocalVar(): boolean {
        return this.isLocal;
    }

    public setIsLocalVar(isLocal: boolean): void {
        this.isLocal = isLocal;
    }

    public setVarIsClosure(): void {
        this._isClosure = true;
    }
}

export class Parameter extends Variable {
    private _isOptional: boolean;
    private _isDestructuring: boolean;

    constructor(
        name: string,
        type: Type,
        modifiers: (ModifierKind | ts.SyntaxKind)[] = [],
        index = -1,
        isOptional = false,
        isDestructuring = false,
        init: Expression | null = null,
        isLocal = true,
    ) {
        super(name, type, modifiers, index, isLocal, init);
        this._isOptional = isOptional;
        this._isDestructuring = isDestructuring;
    }

    get isOptional(): boolean {
        return this._isOptional;
    }

    get destructuring(): boolean {
        return this._isDestructuring;
    }
}

export class VariableScanner {
    typechecker: ts.TypeChecker | undefined = undefined;
    globalScopes = new Array<GlobalScope>();
    currentScope: Scope | null = null;
    nodeScopeMap = new Map<ts.Node, Scope>();
    typeResolver: TypeResolver;

    constructor(private parserCtx: ParserContext) {
        this.globalScopes = this.parserCtx.globalScopes;
        this.nodeScopeMap = this.parserCtx.nodeScopeMap;
        this.typeResolver = this.parserCtx.typeResolver;
    }

    visit() {
        this.typechecker = this.parserCtx.typeChecker;
        this.nodeScopeMap.forEach((scope, node) => {
            this.currentScope = scope;
            ts.forEachChild(node, this.visitNode.bind(this));
        });
    }

    visitNode(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.Parameter: {
                if (
                    node.parent.kind === ts.SyntaxKind.FunctionType ||
                    (node.parent &&
                        node.parent.parent.kind ===
                            ts.SyntaxKind.InterfaceDeclaration)
                ) {
                    break;
                }
                if (ts.isIndexSignatureDeclaration(node.parent)) {
                    break;
                }
                const parameterNode = <ts.ParameterDeclaration>node;
                const functionScope = <FunctionScope>(
                    this.currentScope!.getNearestFunctionScope()
                );
                const paramName = parameterNode.name.getText();
                let isDestructuring = false;
                if (
                    parameterNode.name.kind ===
                    ts.SyntaxKind.ObjectBindingPattern
                ) {
                    isDestructuring = true;
                }
                const isOptional =
                    parameterNode.questionToken || parameterNode.initializer
                        ? true
                        : false;
                const paramModifiers = [];
                if (parameterNode.modifiers !== undefined) {
                    for (const modifier of parameterNode.modifiers) {
                        paramModifiers.push(modifier.kind);
                    }
                }
                const typeName = this.typeResolver.getTsTypeName(node);
                const paramType = functionScope.findType(typeName);
                const paramObj = new Parameter(
                    paramName,
                    paramType!,
                    paramModifiers,
                    -1,
                    isOptional,
                    isDestructuring,
                );
                paramObj.tsNode = node;
                functionScope.addParameter(paramObj);
                break;
            }
            case ts.SyntaxKind.VariableDeclaration: {
                const variableDeclarationNode = <ts.VariableDeclaration>node;
                const currentScope = this.currentScope!;

                let variableModifier = ModifierKind.default;
                if (
                    variableDeclarationNode.parent.kind ===
                    ts.SyntaxKind.VariableDeclarationList
                ) {
                    const variableAssignText =
                        variableDeclarationNode.parent.getText();
                    if (variableAssignText.includes(ModifierKind.const)) {
                        variableModifier = ModifierKind.const;
                    } else if (variableAssignText.includes(ModifierKind.let)) {
                        variableModifier = ModifierKind.let;
                    } else if (variableAssignText.includes(ModifierKind.var)) {
                        variableModifier = ModifierKind.var;
                    }
                }
                const varModifiers = [];
                varModifiers.push(variableModifier);
                const stmtNode = variableDeclarationNode.parent.parent;
                if (ts.isVariableStatement(stmtNode) && stmtNode.modifiers) {
                    for (const modifier of stmtNode.modifiers) {
                        varModifiers.push(modifier.kind);
                    }
                }

                const variableName = variableDeclarationNode.name.getText();
                const typeName = this.typeResolver.getTsTypeName(node);
                let variableType = currentScope.findType(typeName);
                if (!variableType) {
                    throw new Error(
                        `should get variableType for variable ${variableName}`,
                    );
                }

                if (variableType instanceof TSEnum) {
                    variableType = variableType.memberType;
                }

                const variable = new Variable(
                    variableName,
                    variableType!,
                    varModifiers,
                    -1,
                    true,
                );
                variable.tsNode = node;
                if (variable.isDefault()) {
                    currentScope.getRootGloablScope()!.defaultExpr =
                        new IdentifierExpression(variable.varName);
                }

                /** Variables defined by var can be defined repeatedly */
                const funcScope = currentScope.getNearestFunctionScope();
                let belongScope: Scope;
                if (funcScope) {
                    if (variable.isFuncScopedVar()) {
                        belongScope = funcScope;
                    } else {
                        belongScope = currentScope;
                    }
                } else {
                    belongScope = currentScope;
                }
                const existVar = belongScope.findVariable(variableName, false);
                if (!existVar) {
                    belongScope.addVariable(variable);
                }
                break;
            }
            default: {
                if (isScopeNode(node)) {
                    break;
                }
                ts.forEachChild(node, this.visitNode.bind(this));
            }
        }
    }
}

export class VariableInit {
    typechecker: ts.TypeChecker | undefined = undefined;
    globalScopes = new Array<GlobalScope>();
    currentScope: Scope | null = null;
    nodeScopeMap = new Map<ts.Node, Scope>();

    constructor(private parserCtx: ParserContext) {
        this.globalScopes = this.parserCtx.globalScopes;
        this.nodeScopeMap = this.parserCtx.nodeScopeMap;
    }

    visit() {
        this.typechecker = this.parserCtx.typeChecker;
        this.nodeScopeMap.forEach((scope, node) => {
            this.currentScope = scope;
            ts.forEachChild(node, this.visitNode.bind(this));
        });
    }

    visitNode(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.Parameter: {
                if (
                    node.parent.kind === ts.SyntaxKind.FunctionType ||
                    (node.parent &&
                        node.parent.parent.kind ===
                            ts.SyntaxKind.InterfaceDeclaration)
                ) {
                    break;
                }
                if (ts.isIndexSignatureDeclaration(node.parent)) {
                    break;
                }
                const parameterNode = <ts.ParameterDeclaration>node;
                const functionScope = <FunctionScope>(
                    this.currentScope!.getNearestFunctionScope()
                );
                const paramName = parameterNode.name.getText();

                const paramObj = functionScope.findVariable(paramName);
                if (!paramObj) {
                    throw new Error(
                        "don't find " + paramName + ' in current scope',
                    );
                }
                if (parameterNode.initializer) {
                    const paramInit = generateNodeExpression(
                        this.parserCtx.expressionProcessor,
                        parameterNode.initializer,
                    );
                    paramObj.setInitExpr(paramInit);
                }
                break;
            }
            case ts.SyntaxKind.VariableDeclaration: {
                const variableDeclarationNode = <ts.VariableDeclaration>node;
                const currentScope = this.currentScope!;
                const variableName = variableDeclarationNode.name.getText();
                const variableObj = currentScope.findVariable(variableName);
                if (!variableObj) {
                    throw new Error(
                        "don't find " + variableName + ' in current scope',
                    );
                }
                if (
                    !variableObj.isFuncScopedVar() &&
                    variableDeclarationNode.initializer
                ) {
                    this.parserCtx.currentScope = currentScope;
                    const variableInit = generateNodeExpression(
                        this.parserCtx.expressionProcessor,
                        variableDeclarationNode.initializer,
                    );
                    variableObj.setInitExpr(variableInit);
                    if (getConfig().sourceMap) {
                        addSourceMapLoc(
                            variableInit,
                            variableDeclarationNode.initializer,
                        );
                    }
                } else {
                    /*
                       TSC can ensure that variables(except those whose type is 'any') have been assigned before we use them.
                       So when we directly use a variable that has not been assigned a value, the compiler will report an error: 'Variable is used before being assigned.'
                    */
                    // When we use an 'any' type variable that has not been assigned an initial value, the compiler can default its initial value to 'undefined'.
                    if (
                        (variableObj.varType.kind == TypeKind.ANY ||
                            variableObj.varType.kind == TypeKind.UNDEFINED) &&
                        !variableObj.isDeclare() &&
                        !variableDeclarationNode.initializer
                    ) {
                        variableObj.setInitExpr(
                            new IdentifierExpression('undefined'),
                        );
                    }
                }
                break;
            }
            default: {
                if (isScopeNode(node)) {
                    break;
                }
                ts.forEachChild(node, this.visitNode.bind(this));
            }
        }
    }
}
