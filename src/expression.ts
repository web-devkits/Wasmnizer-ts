/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import { ParserContext } from './frontend.js';
import {
    ClassScope,
    ClosureEnvironment,
    FunctionScope,
    Scope,
    importSearchTypes,
} from './scope.js';
import { Variable, Parameter } from './variable.js';
import {
    getCurScope,
    addSourceMapLoc,
    isTypeGeneric,
    processEscape,
    processGenericType,
    calculateTypeArguments,
    methodSpecialize,
} from './utils.js';
import {
    TSFunction,
    Type,
    TypeKind,
    builtinTypes,
    TSTypeParameter,
    TSClass,
} from './type.js';
import { Logger } from './log.js';
import { SourceMapLoc } from './backend/binaryen/utils.js';
import { ExpressionError } from './error.js';
import { getConfig } from '../config/config_mgr.js';

type OperatorKind = ts.SyntaxKind;
type ExpressionKind = ts.SyntaxKind;

export class Expression {
    private kind: ExpressionKind;
    private type: Type = new Type();
    debugLoc: SourceMapLoc | null = null;

    public tsNode?: ts.Node;

    constructor(kind: ExpressionKind) {
        this.kind = kind;
    }

    get expressionKind() {
        return this.kind;
    }

    setExprType(type: Type) {
        this.type = type;
    }

    get exprType(): Type {
        return this.type;
    }
}

export class NullKeywordExpression extends Expression {
    constructor() {
        super(ts.SyntaxKind.NullKeyword);
    }
}

export class UndefinedKeywordExpression extends Expression {
    constructor() {
        super(ts.SyntaxKind.UndefinedKeyword);
    }
}

export class NumberLiteralExpression extends Expression {
    private value: number;

    constructor(value: number) {
        super(ts.SyntaxKind.NumericLiteral);
        this.value = value;
    }

    get expressionValue(): number {
        return this.value;
    }
}

export class StringLiteralExpression extends Expression {
    private value: string;

    constructor(value: string) {
        super(ts.SyntaxKind.StringLiteral);
        this.value = value;
    }

    get expressionValue(): string {
        return this.value;
    }
}

export class ObjectLiteralExpression extends Expression {
    constructor(
        private fields: IdentifierExpression[],
        private values: Expression[],
    ) {
        super(ts.SyntaxKind.ObjectLiteralExpression);
    }

    get objectFields(): IdentifierExpression[] {
        return this.fields;
    }

    get objectValues(): Expression[] {
        return this.values;
    }
}

export class ArrayLiteralExpression extends Expression {
    constructor(private elements: Expression[]) {
        super(ts.SyntaxKind.ArrayLiteralExpression);
    }

    get arrayValues(): Expression[] {
        return this.elements;
    }
}

export class FalseLiteralExpression extends Expression {
    constructor() {
        super(ts.SyntaxKind.FalseKeyword);
    }
}

export class TrueLiteralExpression extends Expression {
    constructor() {
        super(ts.SyntaxKind.TrueKeyword);
    }
}

export class IdentifierExpression extends Expression {
    private identifier: string;

    constructor(identifier: string) {
        super(ts.SyntaxKind.Identifier);
        this.identifier = identifier;
    }

    get identifierName(): string {
        return this.identifier;
    }
}

export class BinaryExpression extends Expression {
    private operator: OperatorKind;
    private left: Expression;
    private right: Expression;

    constructor(operator: OperatorKind, left: Expression, right: Expression) {
        super(ts.SyntaxKind.BinaryExpression);
        this.operator = operator;
        this.left = left;
        this.right = right;
    }

    get operatorKind(): OperatorKind {
        return this.operator;
    }

    get leftOperand(): Expression {
        return this.left;
    }

    get rightOperand(): Expression {
        return this.right;
    }
}

/** EnumerateKeysExpression is a special expression to
 * enumerate keys of an object
 */
export class EnumerateKeysExpression extends Expression {
    private obj: Expression;

    constructor(obj: Expression) {
        super(ts.SyntaxKind.PropertyAccessExpression);
        this.obj = obj;
    }

    get targetObj(): Expression {
        return this.obj;
    }
}

/** if we treat binary expression with comma token as BinaryExpression,
 * we need to apply special handling for this  expression in the semantic tree and backend, and
 * it maybe generate nested block as well
 *  */
export class CommaExpression extends Expression {
    private _exprs: Expression[];
    constructor(exprs: Expression[]) {
        super(ts.SyntaxKind.CommaToken);
        this._exprs = exprs;
    }
    get exprs() {
        return this._exprs;
    }
}

export class UnaryExpression extends Expression {
    private operator: OperatorKind;
    private _operand: Expression;

    constructor(
        kind: ExpressionKind,
        operator: OperatorKind,
        operand: Expression,
    ) {
        super(kind);
        this.operator = operator;
        this._operand = operand;
    }

    get operatorKind(): OperatorKind {
        return this.operator;
    }

    get operand(): Expression {
        return this._operand;
    }
}

export class ConditionalExpression extends Expression {
    constructor(
        private cond: Expression,
        private trueExpr: Expression,
        private falseExpr: Expression,
    ) {
        super(ts.SyntaxKind.ConditionalExpression);
    }

    get condtion(): Expression {
        return this.cond;
    }

    get whenTrue(): Expression {
        return this.trueExpr;
    }

    get whenFalse(): Expression {
        return this.falseExpr;
    }
}

export class CallExpression extends Expression {
    private expr: Expression;
    private args: Expression[];

    constructor(
        expr: Expression,
        args: Expression[] = new Array<Expression>(0),
        private _typeArguments?: Type[],
    ) {
        super(ts.SyntaxKind.CallExpression);
        this.expr = expr;
        this.args = args;
    }

    get callExpr(): Expression {
        return this.expr;
    }

    get callArgs(): Expression[] {
        return this.args;
    }

    get typeArguments(): Type[] | undefined {
        return this._typeArguments;
    }
}

export class SuperExpression extends Expression {
    private args: Expression[] | undefined;

    constructor(args?: Expression[]) {
        super(ts.SyntaxKind.SuperKeyword);
        this.args = args;
    }

    get callArgs(): Expression[] | undefined {
        return this.args;
    }
}

export class PropertyAccessExpression extends Expression {
    private expr: Expression;
    private property: Expression;
    public parent?: Expression;
    accessSetter = false;

    constructor(expr: Expression, property: Expression) {
        super(ts.SyntaxKind.PropertyAccessExpression);
        this.expr = expr;
        this.property = property;
    }

    get propertyAccessExpr(): Expression {
        return this.expr;
    }

    get propertyExpr(): Expression {
        return this.property;
    }
}

export class NewExpression extends Expression {
    private expr: Expression;
    private arguments: Array<Expression> | undefined;
    private newArrayLen = 0;
    private lenExpression: Expression | null = null;

    constructor(
        expr: Expression,
        args?: Array<Expression>,
        private _typeArguments?: Type[],
    ) {
        super(ts.SyntaxKind.NewExpression);
        this.expr = expr;
        this.arguments = args;
    }

    get newExpr(): Expression {
        return this.expr;
    }

    setArgs(args: Array<Expression>) {
        this.arguments = args;
    }

    get newArgs(): Array<Expression> | undefined {
        return this.arguments;
    }

    setArrayLen(arrayLen: number) {
        this.newArrayLen = arrayLen;
    }

    get arrayLen(): number {
        return this.newArrayLen;
    }

    setLenExpr(len: Expression) {
        this.lenExpression = len;
    }

    get lenExpr(): Expression | null {
        return this.lenExpression;
    }

    setTypeArguments(typeArgs: Type[]) {
        this._typeArguments = typeArgs;
    }
    get typeArguments(): Type[] | undefined {
        return this._typeArguments;
    }
}

export class ParenthesizedExpression extends Expression {
    private expr: Expression;

    constructor(expr: Expression) {
        super(ts.SyntaxKind.ParenthesizedExpression);
        this.expr = expr;
    }

    get parentesizedExpr(): Expression {
        return this.expr;
    }
}

export class ElementAccessExpression extends Expression {
    private expr: Expression;
    private argumentExpr: Expression;

    constructor(expr: Expression, argExpr: Expression) {
        super(ts.SyntaxKind.ElementAccessExpression);
        this.expr = expr;
        this.argumentExpr = argExpr;
    }

    get accessExpr(): Expression {
        return this.expr;
    }

    get argExpr(): Expression {
        return this.argumentExpr;
    }
}

export class AsExpression extends Expression {
    private expr: Expression;

    constructor(expr: Expression) {
        super(ts.SyntaxKind.AsExpression);
        this.expr = expr;
    }

    get expression(): Expression {
        return this.expr;
    }
}

export class FunctionExpression extends Expression {
    private _funcScope: FunctionScope;

    constructor(func: FunctionScope) {
        super(ts.SyntaxKind.FunctionExpression);
        this._funcScope = func;
    }

    get funcScope(): FunctionScope {
        return this._funcScope;
    }
}

export class TypeOfExpression extends Expression {
    constructor(private _expr: Expression) {
        super(ts.SyntaxKind.TypeOfExpression);
    }
    get expr() {
        return this._expr;
    }
}

export class SpreadExpression extends Expression {
    constructor(private _target: Expression) {
        super(ts.SyntaxKind.SpreadElement);
    }
    get target() {
        return this._target;
    }
}

export class TemplateExpression extends Expression {
    constructor(
        private _head: StringLiteralExpression,
        private _spans: TmplSpanExpression[],
    ) {
        super(ts.SyntaxKind.TemplateExpression);
    }

    get head() {
        return this._head;
    }

    get spans() {
        return this._spans;
    }
}

export class TmplSpanExpression extends Expression {
    constructor(
        private _expr: Expression,
        private _literal: StringLiteralExpression, // middle or tail expr
    ) {
        super(ts.SyntaxKind.TemplateSpan);
    }

    get expr() {
        return this._expr;
    }

    get literal() {
        return this._literal;
    }
}
export default class ExpressionProcessor {
    private typeResolver;
    private nodeScopeMap;
    private emitSourceMap;

    constructor(private parserCtx: ParserContext) {
        this.typeResolver = this.parserCtx.typeResolver;
        this.nodeScopeMap = this.parserCtx.nodeScopeMap;
        this.emitSourceMap = getConfig().sourceMap;
    }

    visitNode(node: ts.Node): Expression {
        const expr = this.visitNodeInternal(node);
        expr.tsNode = node;
        return expr;
    }

    private visitNodeInternal(node: ts.Node): Expression {
        let res: Expression | null = null;
        switch (node.kind) {
            case ts.SyntaxKind.UndefinedKeyword: {
                const undefinedExpr = new UndefinedKeywordExpression();
                undefinedExpr.setExprType(
                    this.typeResolver.generateNodeType(node),
                );
                return undefinedExpr;
            }
            case ts.SyntaxKind.NullKeyword: {
                res = new NullKeywordExpression();
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.NumericLiteral: {
                res = new NumberLiteralExpression(
                    parseFloat((<ts.NumericLiteral>node).text),
                );
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.StringLiteral: {
                res = new StringLiteralExpression(
                    processEscape((<ts.StringLiteral>node).getText()),
                );
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
                res = new StringLiteralExpression(
                    (<ts.StringLiteral>node).getText().slice(1, -1),
                );
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.FalseKeyword: {
                res = new FalseLiteralExpression();
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.TrueKeyword: {
                res = new TrueLiteralExpression();
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.Identifier: {
                const targetIdentifier = (<ts.Identifier>node).getText();
                res = new IdentifierExpression(targetIdentifier);
                let scope = this.parserCtx.getScopeByNode(node) || null;

                if (!scope) {
                    throw new ExpressionError(
                        `identifier [${targetIdentifier}] doesn't belong to any scope`,
                    );
                }

                const varReferenceScope = scope!.getNearestFunctionScope();
                let variable: Variable | undefined = undefined;
                let maybeClosureVar = false;
                let exprType: Type = builtinTypes.get('undefined')!;

                if (varReferenceScope) {
                    while (scope) {
                        variable = scope.findVariable(targetIdentifier, false);
                        if (variable) {
                            exprType = variable.varType;
                            break;
                        }

                        if (varReferenceScope === scope) {
                            /* Variable not found in current function,
                                it may be a closure var, but we still need
                                to check if it's a global var */
                            maybeClosureVar = true;
                        }
                        scope = scope.parent;
                    }

                    if (maybeClosureVar) {
                        if (scope && scope.getNearestFunctionScope()) {
                            variable!.setVarIsClosure();
                            (scope as ClosureEnvironment).hasFreeVar = true;
                        }
                    }
                }
                if (exprType.kind == TypeKind.UNDEFINED) {
                    /** in order to avoid there is narrowed type checking scope */
                    let declNode = node;
                    const symbol =
                        this.parserCtx.typeChecker!.getSymbolAtLocation(node);
                    if (symbol && symbol.valueDeclaration) {
                        declNode = symbol.valueDeclaration;
                        exprType = this.typeResolver.generateNodeType(declNode);
                    }
                }
                res.setExprType(exprType);
                break;
            }
            case ts.SyntaxKind.BinaryExpression: {
                const binaryExprNode = <ts.BinaryExpression>node;
                const leftExpr = this.visitNode(binaryExprNode.left);
                const rightExpr = this.visitNode(binaryExprNode.right);
                let expr: Expression = new BinaryExpression(
                    binaryExprNode.operatorToken.kind,
                    leftExpr,
                    rightExpr,
                );
                if (
                    binaryExprNode.operatorToken.kind ===
                    ts.SyntaxKind.CommaToken
                ) {
                    let exprs: Expression[] = [];
                    if (leftExpr instanceof CommaExpression) {
                        exprs = exprs.concat(leftExpr.exprs);
                    } else {
                        exprs.push(leftExpr);
                    }
                    if (rightExpr instanceof CommaExpression) {
                        exprs = exprs.concat(rightExpr.exprs);
                    } else {
                        exprs.push(rightExpr);
                    }
                    expr = new CommaExpression(exprs);
                }
                expr.setExprType(this.typeResolver.generateNodeType(node));
                res = expr;
                break;
            }
            case ts.SyntaxKind.PrefixUnaryExpression: {
                const prefixExprNode = <ts.PrefixUnaryExpression>node;
                const operand = this.visitNode(prefixExprNode.operand);
                res = new UnaryExpression(
                    ts.SyntaxKind.PrefixUnaryExpression,
                    prefixExprNode.operator,
                    operand,
                );
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.PostfixUnaryExpression: {
                const postExprNode = <ts.PostfixUnaryExpression>node;
                const operand = this.visitNode(postExprNode.operand);
                res = new UnaryExpression(
                    ts.SyntaxKind.PostfixUnaryExpression,
                    postExprNode.operator,
                    operand,
                );
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.ConditionalExpression: {
                const condExprNode = <ts.ConditionalExpression>node;
                const cond = this.visitNode(condExprNode.condition);
                const whenTrue = this.visitNode(condExprNode.whenTrue);
                const whenFalse = this.visitNode(condExprNode.whenFalse);
                res = new ConditionalExpression(cond, whenTrue, whenFalse);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.NonNullExpression: {
                const nonNullExprNode = <ts.NonNullExpression>node;
                const expr = this.visitNode(nonNullExprNode.expression);
                /* For non-null operation (!), just forward the target expression */
                res = expr;
                break;
            }
            case ts.SyntaxKind.CallExpression: {
                const callExprNode = <ts.CallExpression>node;
                let expr = this.visitNode(callExprNode.expression);
                const args = new Array<Expression>(
                    callExprNode.arguments.length,
                );
                for (let i = 0; i != args.length; ++i) {
                    args[i] = this.visitNode(callExprNode.arguments[i]);
                }
                if (
                    callExprNode.expression.kind === ts.SyntaxKind.SuperKeyword
                ) {
                    const newSuperExpression = new SuperExpression(args);
                    res = newSuperExpression;
                    break;
                }

                // get the list of specialization types
                const originalFuncType = expr.exprType as TSFunction;
                let typeArguments: Type[] = [];
                if (isTypeGeneric(originalFuncType)) {
                    // explicitly declare specialization type typeArguments
                    // e.g.
                    //  function genericFunc<T> (v: T){...}
                    //  genericFunc<number>(5);

                    const typeParameters = originalFuncType.isMethod
                        ? originalFuncType.belongedClass!.typeArguments
                            ? originalFuncType.belongedClass!.typeArguments
                            : originalFuncType.typeArguments!
                        : originalFuncType.typeArguments!;
                    if (callExprNode.typeArguments) {
                        typeArguments = callExprNode.typeArguments.map((t) => {
                            return this.typeResolver.generateNodeType(t);
                        });
                    }
                    // specialize by passing parameters
                    if (typeArguments.length == 0) {
                        // argument type
                        const argTypes = callExprNode.arguments.map((t) => {
                            return this.typeResolver.generateNodeType(t);
                        });
                        // paramter type
                        const formalParameters =
                            originalFuncType.getParamTypes();
                        typeArguments = calculateTypeArguments(
                            formalParameters,
                            typeParameters,
                            argTypes,
                        );
                    }

                    if (typeArguments.length > 0) {
                        const typeNames = new Array<string>();
                        typeArguments.forEach((v) => {
                            if (v.kind !== TypeKind.TYPE_PARAMETER) {
                                if (v instanceof TSClass) {
                                    typeNames.push(v.className);
                                } else {
                                    typeNames.push(`${v.kind}`);
                                }
                            }
                        });
                        const typeSignature =
                            typeNames.length > 0
                                ? '<' + typeNames.join(',') + '>'
                                : '';
                        const isUpdateTypeParameters =
                            typeArguments.filter((type) => isTypeGeneric(type))
                                .length == typeArguments.length;
                        if (
                            callExprNode.expression.kind ===
                            ts.SyntaxKind.Identifier
                        ) {
                            const newFuncType = processGenericType(
                                originalFuncType,
                                typeArguments,
                                typeParameters,
                                this.parserCtx,
                            );
                            if (!isUpdateTypeParameters) {
                                const newIdentifierName =
                                    (expr as IdentifierExpression)
                                        .identifierName + typeSignature;
                                expr = new IdentifierExpression(
                                    newIdentifierName,
                                );
                                const specializedType =
                                    this.parserCtx.currentScope!.findIdentifier(
                                        newIdentifierName,
                                        true,
                                        importSearchTypes.Type,
                                    );
                                if (specializedType)
                                    expr.setExprType(specializedType as Type);
                            } else {
                                expr = new IdentifierExpression(
                                    (
                                        expr as IdentifierExpression
                                    ).identifierName,
                                );
                                expr.setExprType(newFuncType);
                            }
                        } else if (
                            callExprNode.expression.kind ===
                            ts.SyntaxKind.PropertyAccessExpression
                        ) {
                            // process class method
                            const propertyAccess =
                                expr as PropertyAccessExpression;
                            if (
                                propertyAccess.propertyAccessExpr instanceof
                                    IdentifierExpression &&
                                propertyAccess.propertyAccessExpr
                                    .exprType instanceof TSClass
                            ) {
                                const identifierName = (
                                    propertyAccess.propertyAccessExpr as IdentifierExpression
                                ).identifierName;
                                const ownerVariable =
                                    this.parserCtx.currentScope!.findIdentifier(
                                        identifierName,
                                    ) as Variable;
                                const classType =
                                    ownerVariable.varType as TSClass;
                                const methodName = (
                                    propertyAccess.propertyExpr as IdentifierExpression
                                ).identifierName;

                                /**
                                 *  class A {
                                 *      a: number;
                                 *      echo<T>(param: T) {...};
                                 *  }
                                 *  const a = new A();
                                 *  this class type does not contain 'typeParameters', and newExpression does not contain 'typeArguments'.
                                 */
                                if (
                                    !classType.typeArguments &&
                                    originalFuncType.typeArguments
                                ) {
                                    if (
                                        !isUpdateTypeParameters &&
                                        originalFuncType.belongedScope
                                    ) {
                                        const newMethodName =
                                            methodName + typeSignature;
                                        const newPropertyIdentifier =
                                            new IdentifierExpression(
                                                newMethodName,
                                            );
                                        let res =
                                            classType.getMethod(newMethodName);
                                        if (!res.method) {
                                            const origType =
                                                classType.getMethod(methodName);
                                            methodSpecialize(
                                                origType.method!.type,
                                                typeArguments,
                                                this.parserCtx,
                                            );
                                            res =
                                                classType.getMethod(
                                                    newMethodName,
                                                );
                                        }
                                        if (res.method)
                                            newPropertyIdentifier.setExprType(
                                                res.method.type,
                                            );
                                        const tsNode = expr.tsNode;
                                        expr = new PropertyAccessExpression(
                                            (
                                                expr as PropertyAccessExpression
                                            ).propertyAccessExpr,
                                            newPropertyIdentifier,
                                        );
                                        if (res.method)
                                            expr.setExprType(res.method.type);
                                    }
                                } else {
                                    const propertyAccessExpr =
                                        new IdentifierExpression(
                                            identifierName,
                                        );
                                    propertyAccessExpr.setExprType(classType);

                                    const propertyType = classType.getMethod(
                                        methodName,
                                        originalFuncType.funcKind,
                                    )!.method!.type;
                                    const propertyExpr =
                                        new IdentifierExpression(methodName);
                                    propertyExpr.setExprType(propertyType);

                                    const tsNode = expr.tsNode;
                                    expr = new PropertyAccessExpression(
                                        propertyAccessExpr,
                                        propertyExpr,
                                    );
                                    expr.setExprType(propertyType);
                                }
                            }
                        }
                    }
                }
                // get the list of specialization types end

                const callExpr = new CallExpression(
                    expr,
                    args,
                    this.buildTypeArguments(callExprNode.typeArguments),
                );
                if (expr instanceof PropertyAccessExpression)
                    expr.parent = callExpr;
                callExpr.setExprType(this.typeResolver.generateNodeType(node));
                res = callExpr;
                break;
            }
            case ts.SyntaxKind.PropertyAccessExpression: {
                const propAccessExprNode = <ts.PropertyAccessExpression>node;
                const expr = this.visitNode(propAccessExprNode.expression);
                const property = this.visitNode(propAccessExprNode.name);
                res = new PropertyAccessExpression(expr, property);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.ParenthesizedExpression: {
                const expr = this.visitNode(
                    (<ts.ParenthesizedExpression>node).expression,
                );
                res = new ParenthesizedExpression(expr);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.NewExpression: {
                const newExprNode = <ts.NewExpression>node;
                const expr = this.visitNode(newExprNode.expression);
                const newExpr = new NewExpression(expr);
                if (newExprNode.arguments !== undefined) {
                    const args = new Array<Expression>();
                    for (const arg of newExprNode.arguments) {
                        args.push(this.visitNode(arg));
                    }
                    if (args.length > 0)
                        (newExpr as NewExpression).setArgs(args);
                }
                if (newExprNode.typeArguments) {
                    newExpr.setTypeArguments(
                        this.buildTypeArguments(newExprNode.typeArguments)!,
                    );
                }

                if (expr.expressionKind === ts.SyntaxKind.Identifier) {
                    if (
                        (<IdentifierExpression>expr).identifierName === 'Array'
                    ) {
                        if (!newExprNode.typeArguments) {
                            if (!this.typeResolver.arrayTypeCheck(node)) {
                                throw new ExpressionError(
                                    'new Array without declare element type',
                                );
                            }
                        }
                        let isLiteral = false;
                        if (newExprNode.arguments) {
                            /* Check if it's created from a literal */
                            const argLen = newExprNode.arguments.length;
                            if (argLen > 1) {
                                isLiteral = true;
                            } else if (argLen === 1) {
                                const elem = newExprNode.arguments[0];
                                const elemExpr = this.visitNode(elem);
                                if (
                                    elemExpr.exprType.kind !==
                                        TypeKind.NUMBER &&
                                    elemExpr.exprType.kind !==
                                        TypeKind.WASM_I32 &&
                                    elemExpr.exprType.kind !==
                                        TypeKind.WASM_I64 &&
                                    elemExpr.exprType.kind !==
                                        TypeKind.WASM_F32 &&
                                    elemExpr.exprType.kind !== TypeKind.WASM_F64
                                ) {
                                    isLiteral = true;
                                }
                            }

                            if (isLiteral) {
                                const elemExprs = newExprNode.arguments.map(
                                    (a) => {
                                        return this.visitNode(a);
                                    },
                                );
                                newExpr.setArrayLen(argLen);
                                newExpr.setArgs(elemExprs);
                            } else if (argLen === 1) {
                                newExpr.setLenExpr(
                                    this.visitNode(newExprNode.arguments[0]),
                                );
                            }
                            /* else no arguments */
                        } else {
                            newExpr.setLenExpr(new NumberLiteralExpression(0));
                        }
                        newExpr.setExprType(
                            this.typeResolver.generateNodeType(node),
                        );
                    } else {
                        // handling generic types chain
                        if (
                            expr.exprType instanceof TSClass &&
                            isTypeGeneric(expr.exprType)
                        ) {
                            const genericClassType = expr.exprType;
                            const typeParameters =
                                genericClassType.typeArguments;

                            if (typeParameters) {
                                let typeArguments = new Array<Type>();
                                if (newExpr.newArgs) {
                                    // argument type
                                    const argTypes: Type[] = [];
                                    for (const arg of newExpr.newArgs) {
                                        argTypes.push(arg.exprType);
                                    }
                                    // paramter type
                                    const formalParameters =
                                        genericClassType.ctorType.getParamTypes();
                                    typeArguments = calculateTypeArguments(
                                        formalParameters,
                                        typeParameters,
                                        argTypes,
                                    );
                                } else if (newExpr.typeArguments) {
                                    typeArguments = newExpr.typeArguments;
                                }
                                if (typeArguments.length > 0) {
                                    const newClassType = processGenericType(
                                        genericClassType,
                                        typeArguments,
                                        typeParameters,
                                        this.parserCtx,
                                    );
                                    const newIdentifierExpression =
                                        new IdentifierExpression(
                                            (newClassType as TSClass).className,
                                        );
                                    newIdentifierExpression.setExprType(
                                        newClassType,
                                    );
                                    const newNewExpr = new NewExpression(
                                        newIdentifierExpression,
                                        newExpr.newArgs,
                                    );
                                    newNewExpr.setExprType(newClassType);
                                    res = newNewExpr;
                                    break;
                                }
                            }
                        }
                    }
                }

                newExpr.setExprType(this.typeResolver.generateNodeType(node));
                res = newExpr;
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                const objLiteralNode = <ts.ObjectLiteralExpression>node;
                const fields = new Array<IdentifierExpression>();
                const values = new Array<Expression>();
                let propertyAssign:
                    | ts.PropertyAssignment
                    | ts.ShorthandPropertyAssignment
                    | ts.MethodDeclaration;

                for (const property of objLiteralNode.properties) {
                    if (
                        ts.isPropertyAssignment(property) ||
                        ts.isShorthandPropertyAssignment(property) ||
                        ts.isMethodDeclaration(property)
                    ) {
                        propertyAssign = property;
                    } else {
                        throw new ExpressionError(
                            `Unimpl accessing property of kind : ${property.kind}`,
                        );
                    }
                    fields.push(
                        new IdentifierExpression(propertyAssign.name.getText()),
                    );
                    const init = ts.isPropertyAssignment(propertyAssign)
                        ? propertyAssign.initializer
                        : propertyAssign;
                    values.push(this.visitNode(init));
                }
                res = new ObjectLiteralExpression(fields, values);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.ArrayLiteralExpression: {
                const arrLiteralNode = <ts.ArrayLiteralExpression>node;
                const elements = new Array<Expression>();
                for (const elem of arrLiteralNode.elements) {
                    elements.push(this.visitNode(elem));
                }
                res = new ArrayLiteralExpression(elements);
                res.setExprType(this.typeResolver.generateNodeType(node));
                if (this.emitSourceMap) {
                    addSourceMapLoc(res, node);
                }
                break;
            }
            case ts.SyntaxKind.AsExpression: {
                const asExprNode = <ts.AsExpression>node;
                const expr = this.visitNode(asExprNode.expression);
                const typeNode = asExprNode.type;
                res = new AsExpression(expr);
                res.setExprType(this.typeResolver.generateNodeType(typeNode));
                break;
            }
            case ts.SyntaxKind.ShorthandPropertyAssignment: {
                const ShorthandPropertyAssignNode = <
                    ts.ShorthandPropertyAssignment
                >node;
                const name = ShorthandPropertyAssignNode.name;
                res = this.visitNode(name);
                break;
            }
            case ts.SyntaxKind.ElementAccessExpression: {
                const elementAccessExprNode = <ts.ElementAccessExpression>node;
                const expr = this.visitNode(elementAccessExprNode.expression);
                const argExpr = this.visitNode(
                    elementAccessExprNode.argumentExpression,
                );
                res = new ElementAccessExpression(expr, argExpr);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.MethodDeclaration: {
                const funcScope = getCurScope(node, this.nodeScopeMap)!;
                res = new FunctionExpression(funcScope as FunctionScope);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.ThisKeyword: {
                res = new IdentifierExpression('this');
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            case ts.SyntaxKind.TypeOfExpression: {
                const typeofExpr = <ts.TypeOfExpression>node;
                res = new TypeOfExpression(
                    this.visitNode(typeofExpr.expression),
                );
                res.setExprType(this.typeResolver.generateNodeType(typeofExpr));
                break;
            }
            case ts.SyntaxKind.SuperKeyword: {
                res = new SuperExpression();
                break;
            }
            case ts.SyntaxKind.SpreadElement: {
                const spreadElement = node as ts.SpreadElement;
                const target = this.visitNode(spreadElement.expression);
                res = new SpreadExpression(target);
                res.setExprType(
                    this.typeResolver.generateNodeType(
                        spreadElement.expression,
                    ),
                );
                break;
            }
            case ts.SyntaxKind.TemplateHead:
            case ts.SyntaxKind.TemplateMiddle:
            case ts.SyntaxKind.TemplateTail: {
                const head = <ts.TemplateLiteralLikeNode>node;
                res = new StringLiteralExpression(head.text);
                // tsc will infer its type as any
                res.setExprType(builtinTypes.get('string')!);
                break;
            }
            case ts.SyntaxKind.TemplateExpression: {
                const tplExpr = <ts.TemplateExpression>node;
                const head = this.visitNode(
                    tplExpr.head,
                ) as StringLiteralExpression;
                const spans = tplExpr.templateSpans.map((span) => {
                    const expr = this.visitNode(span.expression);
                    const literal = this.visitNode(span.literal);
                    return new TmplSpanExpression(
                        expr,
                        literal as StringLiteralExpression,
                    );
                });
                res = new TemplateExpression(head, spans);
                res.setExprType(this.typeResolver.generateNodeType(node));
                break;
            }
            default:
                Logger.warn(
                    `Encounter un-processed expression, kind: ${node.kind}`,
                );
                return new Expression(ts.SyntaxKind.Unknown);
        }
        if (this.emitSourceMap) {
            addSourceMapLoc(res, node);
        }
        return res;
    }

    buildTypeArguments(
        typeArguments?: ts.NodeArray<ts.TypeNode>,
    ): Type[] | undefined {
        if (!typeArguments) return undefined;

        const types: Type[] = [];
        for (const tynode of typeArguments!) {
            const tstype =
                this.typeResolver.typechecker!.getTypeFromTypeNode(tynode);
            types.push(this.typeResolver.tsTypeToType(tstype));
        }
        return types;
    }

    specializeExpression(
        expr: Expression,
        typeArguments: Type[],
        typeParameters: TSTypeParameter[],
        currentFuncScope: Scope,
    ): Expression {
        let res = expr;
        const exprType = expr.exprType;
        if (typeArguments.length == 0 || typeParameters.length == 0) return res;
        switch (expr.expressionKind) {
            case ts.SyntaxKind.Identifier: {
                const identifierExpression = expr as IdentifierExpression;
                let identifierName = identifierExpression.identifierName;
                if (identifierName == 'undefined') {
                    return expr;
                }
                if (identifierName == 'this') {
                    const newIdentifierExpression = new IdentifierExpression(
                        identifierName,
                    );
                    const thisVarType = processGenericType(
                        identifierExpression.exprType,
                        typeArguments,
                        typeParameters,
                        this.parserCtx,
                    );
                    newIdentifierExpression.setExprType(thisVarType);
                    res = newIdentifierExpression;
                    return res;
                }

                const typeArgumentsSignature = new Array<string>();
                const ret = currentFuncScope.findIdentifier(identifierName);
                if (ret) {
                    if (ret instanceof TSClass || ret instanceof ClassScope) {
                        if (
                            isTypeGeneric(exprType) &&
                            (exprType as TSClass).typeArguments
                        ) {
                            const types = (exprType as TSClass).typeArguments!;
                            types.forEach((type) => {
                                const index = typeParameters.findIndex((t) => {
                                    return t.name === type.name;
                                });
                                if (index == -1) {
                                    throw new ExpressionError(
                                        `${type.name} not found in typeParameters`,
                                    );
                                }
                                if (
                                    typeArguments[index].kind !==
                                    TypeKind.TYPE_PARAMETER
                                )
                                    typeArgumentsSignature.push(
                                        `${typeArguments[index].kind}`,
                                    );
                            });
                        }
                    }
                    if (ret instanceof FunctionScope) {
                        if (isTypeGeneric(exprType)) {
                            const types = (exprType as TSFunction)
                                .typeArguments!;
                            types.forEach((type) => {
                                const index = typeParameters.findIndex((t) => {
                                    return t.name === type.name;
                                });
                                if (index == -1) {
                                    throw new ExpressionError(
                                        `${type.name} not found in typeParameters`,
                                    );
                                }
                                if (
                                    typeArguments[index].kind !==
                                    TypeKind.TYPE_PARAMETER
                                ) {
                                    if (
                                        typeArguments[index] instanceof TSClass
                                    ) {
                                        typeArgumentsSignature.push(
                                            (typeArguments[index] as TSClass)
                                                .className,
                                        );
                                    } else {
                                        typeArgumentsSignature.push(
                                            `${typeArguments[index].kind}`,
                                        );
                                    }
                                }
                            });
                        }
                    }
                    const typeSignature =
                        typeArgumentsSignature.length > 0
                            ? '<' + typeArgumentsSignature.join(',') + '>'
                            : '';
                    identifierName = identifierName + typeSignature;
                }

                const newIdentifierExpression = new IdentifierExpression(
                    identifierName,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newIdentifierExpression.setExprType(newExprType);
                res = newIdentifierExpression;
                break;
            }
            case ts.SyntaxKind.BinaryExpression: {
                const binaryBinaryExpression = expr as BinaryExpression;
                const leftExpr = this.specializeExpression(
                    binaryBinaryExpression.leftOperand,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const rightExpr = this.specializeExpression(
                    binaryBinaryExpression.rightOperand,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newBinaryExpression = new BinaryExpression(
                    binaryBinaryExpression.operatorKind,
                    leftExpr,
                    rightExpr,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newBinaryExpression.setExprType(newExprType);
                res = newBinaryExpression;
                break;
            }
            case ts.SyntaxKind.PrefixUnaryExpression: {
                const prefixUnaryExpression = expr as UnaryExpression;
                const newOperand = this.specializeExpression(
                    prefixUnaryExpression.operand,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newprefixUnaryExpression = new UnaryExpression(
                    ts.SyntaxKind.PrefixUnaryExpression,
                    prefixUnaryExpression.operatorKind,
                    newOperand,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newprefixUnaryExpression.setExprType(newExprType);
                res = newprefixUnaryExpression;
                break;
            }
            case ts.SyntaxKind.PostfixUnaryExpression: {
                const postfixUnaryExpression = expr as UnaryExpression;
                const newOperand = this.specializeExpression(
                    postfixUnaryExpression.operand,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newUnaryExpression = new UnaryExpression(
                    ts.SyntaxKind.PostfixUnaryExpression,
                    postfixUnaryExpression.operatorKind,
                    newOperand,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newUnaryExpression.setExprType(newExprType);
                res = newUnaryExpression;
                break;
            }
            case ts.SyntaxKind.ConditionalExpression: {
                const conditionalExpression = expr as ConditionalExpression;
                const newCondition = this.specializeExpression(
                    conditionalExpression.condtion,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newTrueExpr = this.specializeExpression(
                    conditionalExpression.whenTrue,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newFalseExpr = this.specializeExpression(
                    conditionalExpression.whenFalse,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newConditionalExpression = new ConditionalExpression(
                    newCondition,
                    newTrueExpr,
                    newFalseExpr,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newConditionalExpression.setExprType(newExprType);
                res = newConditionalExpression;
                break;
            }
            case ts.SyntaxKind.CallExpression: {
                const callExpression = expr as CallExpression;
                let callExpr = callExpression.callExpr;
                const args = new Array<Expression>(
                    callExpression.callArgs.length,
                );
                for (let i = 0; i != args.length; ++i) {
                    args[i] = this.specializeExpression(
                        callExpression.callArgs[i],
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                }

                if (callExpr.expressionKind === ts.SyntaxKind.Identifier) {
                    const identifierExpression =
                        callExpr as IdentifierExpression;
                    const exprType =
                        identifierExpression.exprType as TSFunction;
                    if (isTypeGeneric(exprType)) {
                        const typeArguments: Type[] = [];
                        for (let idx = 0; idx < args.length; idx++) {
                            typeArguments.push(args[idx].exprType);
                        }
                        callExpr = this.specializeExpression(
                            identifierExpression,
                            typeArguments,
                            exprType.typeArguments!,
                            currentFuncScope,
                        );
                    }
                } else if (
                    callExpr.expressionKind ===
                    ts.SyntaxKind.PropertyAccessExpression
                ) {
                    const propertyAccessExpression =
                        callExpr as PropertyAccessExpression;
                    callExpr = this.specializeExpression(
                        propertyAccessExpression,
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                }
                const newCallExpression = new CallExpression(callExpr, args);
                if (callExpr instanceof PropertyAccessExpression)
                    callExpr.parent = newCallExpression;

                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newCallExpression.setExprType(newExprType);
                res = newCallExpression;
                break;
            }
            case ts.SyntaxKind.PropertyAccessExpression: {
                const propertyAccessExpression =
                    expr as PropertyAccessExpression;
                let propertyAccessExpr =
                    propertyAccessExpression.propertyAccessExpr;
                let propertyExpr = propertyAccessExpression.propertyExpr;

                if (
                    propertyAccessExpr.exprType instanceof TSClass &&
                    isTypeGeneric(propertyAccessExpr.exprType)
                ) {
                    const ownerType = propertyAccessExpr.exprType;
                    let propertyName = (propertyExpr as IdentifierExpression)
                        .identifierName;
                    let propertyType: Type = propertyExpr.exprType;

                    propertyAccessExpr = this.specializeExpression(
                        propertyAccessExpr,
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                    // method call
                    if (propertyExpr.exprType instanceof TSFunction) {
                        const funcKind = propertyExpr.exprType.funcKind;
                        if (ownerType.typeArguments) {
                            propertyType = (
                                propertyAccessExpr.exprType as TSClass
                            ).getMethod(propertyName, funcKind)!.method!.type;
                        } else {
                            const typeArgumentsSignature: Array<string> = [];
                            const _typeParameters =
                                propertyExpr.exprType.typeArguments;
                            if (_typeParameters) {
                                typeArguments.forEach((t) => {
                                    if (t.kind !== TypeKind.TYPE_PARAMETER)
                                        typeArgumentsSignature.push(
                                            `${t.kind}`,
                                        );
                                });
                            }
                            const typeSignature =
                                typeArgumentsSignature.length > 0
                                    ? '<' +
                                      typeArgumentsSignature.join(',') +
                                      '>'
                                    : '';
                            propertyName = propertyName + typeSignature;
                            propertyType = (
                                propertyAccessExpr.exprType as TSClass
                            ).getMethod(propertyName, funcKind)!.method!.type;
                        }
                    } else {
                        // field access
                        //member field
                        (propertyAccessExpr.exprType as TSClass).fields.forEach(
                            (f) => {
                                if (f.name == propertyName) {
                                    propertyType = f.type;
                                }
                            },
                        );
                        //static field
                        (
                            propertyAccessExpr.exprType as TSClass
                        ).staticFields.forEach((f) => {
                            if (f.name == propertyName) {
                                propertyType = f.type;
                            }
                        });
                    }
                    propertyExpr = new IdentifierExpression(propertyName);
                    propertyExpr.setExprType(propertyType);
                } else {
                    propertyAccessExpr = this.specializeExpression(
                        propertyAccessExpr,
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                    propertyExpr = this.specializeExpression(
                        propertyExpr,
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                }

                const newPropertyAccessExpression =
                    new PropertyAccessExpression(
                        propertyAccessExpr,
                        propertyExpr,
                    );
                newPropertyAccessExpression.setExprType(propertyExpr.exprType);
                res = newPropertyAccessExpression;
                break;
            }
            case ts.SyntaxKind.ParenthesizedExpression: {
                const parenthesizedExpression = expr as ParenthesizedExpression;
                const newParentesizedExpr = this.specializeExpression(
                    parenthesizedExpression.parentesizedExpr,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newParenthesizedExpression = new ParenthesizedExpression(
                    newParentesizedExpr,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newParenthesizedExpression.setExprType(newExprType);
                res = newParenthesizedExpression;
                break;
            }
            case ts.SyntaxKind.NewExpression: {
                const newExpression = expr as NewExpression;
                if (!newExpression.newArgs && !newExpression.typeArguments)
                    return newExpression;

                const args: Array<Expression> = [];
                if (newExpression.newArgs) {
                    for (let i = 0; i != newExpression.newArgs.length; ++i) {
                        const argExpr = this.specializeExpression(
                            newExpression.newArgs[i],
                            typeArguments,
                            typeParameters,
                            currentFuncScope,
                        );
                        args.push(argExpr);
                    }
                }
                if (
                    newExpression.newExpr.expressionKind ===
                    ts.SyntaxKind.Identifier
                ) {
                    const identifierExpression =
                        newExpression.newExpr as IdentifierExpression;
                    const newIdentifierExpression = this.specializeExpression(
                        identifierExpression,
                        typeArguments,
                        typeParameters,
                        currentFuncScope,
                    );
                    res = new NewExpression(newIdentifierExpression, args);
                    res.setExprType(newIdentifierExpression.exprType);
                }
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                const objectLiteralExpression = expr as ObjectLiteralExpression;
                const fields = new Array<IdentifierExpression>();
                const values = new Array<Expression>();
                for (const f of objectLiteralExpression.objectFields) {
                    fields.push(
                        this.specializeExpression(
                            f,
                            typeArguments,
                            typeParameters,
                            currentFuncScope,
                        ) as IdentifierExpression,
                    );
                }
                for (const v of objectLiteralExpression.objectValues) {
                    values.push(
                        this.specializeExpression(
                            v,
                            typeArguments,
                            typeParameters,
                            currentFuncScope,
                        ),
                    );
                }

                const newObjectLiteralExpression = new ObjectLiteralExpression(
                    fields,
                    values,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newObjectLiteralExpression.setExprType(newExprType);
                res = newObjectLiteralExpression;
                break;
            }
            case ts.SyntaxKind.ArrayLiteralExpression: {
                const arrayLiteralExpression = expr as ArrayLiteralExpression;
                const elements = new Array<Expression>();
                for (const elem of arrayLiteralExpression.arrayValues) {
                    elements.push(
                        this.specializeExpression(
                            elem,
                            typeArguments,
                            typeParameters,
                            currentFuncScope,
                        ),
                    );
                }
                const newArrayLiteralExpression = new ArrayLiteralExpression(
                    elements,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newArrayLiteralExpression.setExprType(newExprType);
                res = newArrayLiteralExpression;
                break;
            }
            case ts.SyntaxKind.AsExpression: {
                const asExpression = expr as AsExpression;
                const newExpr = this.specializeExpression(
                    asExpression.expression,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newAsExpression = new AsExpression(newExpr);
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newAsExpression.setExprType(newExprType);
                res = newAsExpression;
                break;
            }
            case ts.SyntaxKind.ElementAccessExpression: {
                const elementAccessExprNode = expr as ElementAccessExpression;
                const newAccessExpr = this.specializeExpression(
                    elementAccessExprNode.accessExpr,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );
                const newArgExpr = this.specializeExpression(
                    elementAccessExprNode.argExpr,
                    typeArguments,
                    typeParameters,
                    currentFuncScope,
                );

                const newElementAccessExpression = new ElementAccessExpression(
                    newAccessExpr,
                    newArgExpr,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newElementAccessExpression.setExprType(newExprType);
                res = newElementAccessExpression;
                break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.MethodDeclaration: {
                const functionExpression = expr as FunctionExpression;
                const funcScope = functionExpression.funcScope;
                const newFuncScope = new FunctionScope(currentFuncScope);
                funcScope.specialize(newFuncScope);
                // specialize this new FunctionScope
                newFuncScope.setClassName(funcScope.className);
                newFuncScope.debugFilePath = funcScope.debugFilePath;
                newFuncScope.setFuncName(funcScope.funcName);
                const newFuncType = isTypeGeneric(funcScope.funcType)
                    ? processGenericType(
                          funcScope.funcType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : funcScope.funcType;
                newFuncScope.setFuncType(newFuncType as TSFunction);
                newFuncScope.setGenericOwner(funcScope);
                funcScope.addSpecializedScope(funcScope.funcName, newFuncScope);
                newFuncScope.hasFreeVar = funcScope.hasFreeVar;
                newFuncScope.mangledName =
                    newFuncScope.parent!.mangledName +
                    '|' +
                    newFuncScope.getName();
                funcScope.paramArray.forEach((v) => {
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
                            ? this.specializeExpression(
                                  initExpression,
                                  typeArguments,
                                  typeParameters,
                                  newFuncScope,
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
                    newFuncScope.addParameter(new_parameter);
                });
                funcScope.varArray.forEach((v) => {
                    if (v.varName == '@context') {
                        const contextVar = new Variable(
                            '@context',
                            v.varType,
                            v.varModifiers,
                            v.varIndex,
                            v.isLocalVar(),
                            v.initExpression,
                        );
                        contextVar.scope = newFuncScope;
                        newFuncScope.contextVariable = contextVar;
                        newFuncScope.addVariable(contextVar);
                    }
                });

                funcScope.statements.forEach((s) => {
                    const stmt =
                        this.parserCtx.statementSpecializationProcessor.processStatement(
                            s,
                            typeArguments,
                            typeParameters,
                            currentFuncScope,
                        );
                    newFuncScope.addStatement(stmt);
                });

                const newFunctionExpression = new FunctionExpression(
                    newFuncScope,
                );
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newFunctionExpression.setExprType(newExprType);
                res = newFunctionExpression;
                break;
            }
            case ts.SyntaxKind.SuperKeyword: {
                const superExpression = expr as SuperExpression;
                const args: Array<Expression> = [];
                if (superExpression.callArgs) {
                    for (let i = 0; i != superExpression.callArgs.length; ++i) {
                        args.push(
                            this.specializeExpression(
                                superExpression.callArgs[i],
                                typeArguments,
                                typeParameters,
                                currentFuncScope,
                            ),
                        );
                    }
                }
                const newSuperExpression = new SuperExpression(args);
                const newExprType = isTypeGeneric(exprType)
                    ? processGenericType(
                          exprType,
                          typeArguments,
                          typeParameters,
                          this.parserCtx,
                      )
                    : exprType;
                newSuperExpression.setExprType(newExprType);
                res = newSuperExpression;
                break;
            }
            default:
                res = expr;
        }
        res.tsNode = expr.tsNode;
        return res;
    }
}
