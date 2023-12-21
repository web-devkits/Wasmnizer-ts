/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import { ParserContext } from './frontend.js';
import { ClosureEnvironment, FunctionScope } from './scope.js';
import { Variable } from './variable.js';
import {
    getCurScope,
    addSourceMapLoc,
    isTypeGeneric,
    processEscape,
} from './utils.js';
import {
    TSArray,
    TSFunction,
    Type,
    TypeKind,
    TypeResolver,
    builtinTypes,
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
                /** in order to avoid there is narrowed type checking scope */
                let declNode = node;
                const symbol =
                    this.parserCtx.typeChecker!.getSymbolAtLocation(node);
                if (symbol && symbol.valueDeclaration) {
                    declNode = symbol.valueDeclaration;
                    exprType = this.typeResolver.generateNodeType(declNode);
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
                    res = new SuperExpression(args);
                    res.setExprType(this.typeResolver.generateNodeType(node));
                    break;
                }

                // iff a generic function is specialized and called
                const origType = this.typeResolver.generateNodeType(
                    callExprNode.expression,
                ) as TSFunction;
                const originalFunctionScope = origType.belongedScope;
                // without FunctionScope information, generic functions cannot be specialized
                if (isTypeGeneric(origType) && originalFunctionScope) {
                    // the function name of the CallExpression is corrected to the specialized function name
                    let typeArguments: Type[] | undefined;

                    // explicitly declare specialization type typeArguments
                    // e.g.
                    //  function genericFunc<T> (v: T){...}
                    //  genericFunc<number>(5);
                    if (callExprNode.typeArguments) {
                        typeArguments = callExprNode.typeArguments.map((t) => {
                            return this.typeResolver.generateNodeType(t);
                        });
                    }
                    // specialize by passing parameters
                    // e.g.
                    //  function genericFunc<T> (v: T){...}
                    //  genericFunc('hello');
                    if (!typeArguments) {
                        const _typeArguments: Type[] = [];
                        // argument type
                        const _arguments = callExprNode.arguments.map((t) => {
                            return this.typeResolver.generateNodeType(t);
                        });
                        // paramter type
                        const _paramters = origType.getParamTypes();

                        // TODO: Handling optional parameters
                        for (let i = 0; i < _paramters.length; i++) {
                            if (
                                isTypeGeneric(_paramters[i]) &&
                                !isTypeGeneric(_arguments[i])
                            ) {
                                if (
                                    _paramters[i].kind ==
                                    TypeKind.TYPE_PARAMETER
                                ) {
                                    _typeArguments.push(_arguments[i]);
                                } else if (
                                    _paramters[i].kind == TypeKind.ARRAY
                                ) {
                                    const elementType = (
                                        _arguments[i] as TSArray
                                    ).elementType;
                                    _typeArguments.push(elementType);
                                }
                            }
                        }
                        typeArguments = _typeArguments;
                    }
                    // there is a specialization types list
                    if (typeArguments.length > 0) {
                        const typeNames = new Array<string>();
                        typeArguments.forEach((v) => {
                            typeNames.push(`${v.kind}`);
                        });
                        const typeSignature = '<' + typeNames.join(',') + '>';

                        if (
                            callExprNode.expression.kind ===
                            ts.SyntaxKind.Identifier
                        ) {
                            let genericInheritance = false;
                            typeArguments.forEach((t) => {
                                if (isTypeGeneric(t)) {
                                    genericInheritance = true;
                                }
                            });
                            if (!genericInheritance) {
                                const newIdentifierName =
                                    (expr as IdentifierExpression)
                                        .identifierName + typeSignature;
                                expr = new IdentifierExpression(
                                    newIdentifierName,
                                );

                                // the function type of the CallExpression is corrected to the specialized function type
                                const specializedType =
                                    this.parserCtx.currentScope!.findIdentifier(
                                        newIdentifierName,
                                    );
                                if (specializedType)
                                    expr.setExprType(specializedType as Type);
                            }
                        } else if (
                            callExprNode.expression.kind ===
                            ts.SyntaxKind.PropertyAccessExpression
                        ) {
                            const classType = origType.belongedClass!;
                            // if a generic function in a generic class is called, it will be processed according to the logic for processing generic class
                            if (!classType.typeArguments) {
                                const propertyName = (
                                    (expr as PropertyAccessExpression)
                                        .propertyExpr as IdentifierExpression
                                ).identifierName;
                                const newPropertyName =
                                    propertyName + typeSignature;
                                const newPropertyIdentifier =
                                    new IdentifierExpression(newPropertyName);
                                let res = classType.getMethod(newPropertyName);
                                if (!res.method) {
                                    const origType =
                                        classType.getMethod(propertyName);
                                    TypeResolver.specializeClassMethod(
                                        classType,
                                        propertyName,
                                        typeArguments,
                                    );
                                    res = classType.getMethod(newPropertyName);
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
                                expr.tsNode = tsNode;
                                if (res.method)
                                    expr.setExprType(res.method.type);
                            }
                        }
                    }
                }

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
                if (
                    expr.expressionKind === ts.SyntaxKind.Identifier &&
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
                            if (elemExpr.exprType.kind !== TypeKind.NUMBER) {
                                isLiteral = true;
                            }
                        }

                        if (isLiteral) {
                            const elemExprs = newExprNode.arguments.map((a) => {
                                return this.visitNode(a);
                            });
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

                    if (newExprNode.typeArguments) {
                        newExpr.setTypeArguments(
                            this.buildTypeArguments(newExprNode.typeArguments)!,
                        );
                    }

                    newExpr.setExprType(
                        this.typeResolver.generateNodeType(node),
                    );
                } else {
                    if (newExprNode.arguments !== undefined) {
                        const args = new Array<Expression>();
                        for (const arg of newExprNode.arguments) {
                            args.push(this.visitNode(arg));
                        }
                        (newExpr as NewExpression).setArgs(args);
                    }
                }
                if (newExprNode.typeArguments) {
                    newExpr.setTypeArguments(
                        this.buildTypeArguments(newExprNode.typeArguments)!,
                    );
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
                res.setExprType(this.typeResolver.generateNodeType(node));
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
}
