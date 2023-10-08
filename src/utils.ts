/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import path from 'path';
import {
    BlockScope,
    ClassScope,
    FunctionScope,
    GlobalScope,
    NamespaceScope,
    Scope,
    ScopeKind,
} from './scope.js';
import ExpressionProcessor, {
    Expression,
    IdentifierExpression,
} from './expression.js';
import { BuiltinNames } from '../lib/builtin/builtin_name.js';
import {
    FunctionKind,
    getMethodPrefix,
    Type,
    TSInterface,
    TypeKind,
    TSClass,
    TSTypeParameter,
    TSFunction,
    TSArray,
    TSUnion,
} from './type.js';
import { UnimplementError } from './error.js';
import { Statement } from './statement.js';
import { Variable, Parameter } from './variable.js';

export interface importGlobalInfo {
    internalName: string;
    externalModuleName: string;
    externalBaseName: string;
    globalType: Type;
}

export interface importFunctionInfo {
    internalName: string;
    externalModuleName: string;
    externalBaseName: string;
    funcType: Type;
}

export enum MatchKind {
    ExactMatch,
    ToAnyMatch,
    FromAnyMatch,
    ClassMatch,
    ClassInheritMatch,
    ClassInfcMatch,
    ToArrayAnyMatch,
    FromArrayAnyMatch,
    MisMatch,
}

export class Stack<T> {
    private items: T[] = [];
    push(item: T) {
        this.items.push(item);
    }
    pop() {
        if (this.isEmpty()) {
            throw new Error('Current stack is empty, can not pop');
        }
        return this.items.pop()!;
    }
    peek() {
        if (this.isEmpty()) {
            throw new Error('Current stack is empty, can not get peek item');
        }
        return this.items[this.items.length - 1];
    }
    isEmpty() {
        return this.items.length === 0;
    }
    clear() {
        this.items = [];
    }
    size() {
        return this.items.length;
    }
    getItemAtIdx(index: number) {
        if (index >= this.items.length) {
            throw new Error('index is greater than the size of the stack');
        }
        return this.items[index];
    }
}

export function getCurScope(
    node: ts.Node,
    nodeScopeMap: Map<ts.Node, Scope>,
): Scope | null {
    if (!node) return null;
    const scope = nodeScopeMap.get(node);
    if (scope) return scope;
    return getCurScope(node.parent, nodeScopeMap);
}

export function getNearestFunctionScopeFromCurrent(currentScope: Scope | null) {
    if (!currentScope) {
        throw new Error('current scope is null');
    }
    const functionScope = currentScope.getNearestFunctionScope();
    if (!functionScope) {
        return null;
    }
    return functionScope;
}

export function generateNodeExpression(
    exprCompiler: ExpressionProcessor,
    node: ts.Node,
): Expression {
    return exprCompiler.visitNode(node);
}

export function parentIsFunctionLike(node: ts.Node) {
    if (
        node.parent.kind === ts.SyntaxKind.FunctionDeclaration ||
        node.parent.kind === ts.SyntaxKind.MethodDeclaration ||
        node.parent.kind === ts.SyntaxKind.SetAccessor ||
        node.parent.kind === ts.SyntaxKind.GetAccessor ||
        node.parent.kind === ts.SyntaxKind.FunctionExpression ||
        node.parent.kind === ts.SyntaxKind.ArrowFunction ||
        node.parent.kind === ts.SyntaxKind.Constructor
    ) {
        return true;
    }

    return false;
}

export function isScopeNode(node: ts.Node) {
    if (
        node.kind === ts.SyntaxKind.SourceFile ||
        node.kind === ts.SyntaxKind.ModuleDeclaration ||
        node.kind === ts.SyntaxKind.FunctionDeclaration ||
        node.kind === ts.SyntaxKind.FunctionExpression ||
        node.kind === ts.SyntaxKind.ArrowFunction ||
        node.kind === ts.SyntaxKind.ClassDeclaration ||
        node.kind === ts.SyntaxKind.SetAccessor ||
        node.kind === ts.SyntaxKind.GetAccessor ||
        node.kind === ts.SyntaxKind.Constructor ||
        node.kind === ts.SyntaxKind.MethodDeclaration ||
        node.kind === ts.SyntaxKind.ForStatement ||
        node.kind === ts.SyntaxKind.ForOfStatement ||
        node.kind === ts.SyntaxKind.WhileStatement ||
        node.kind === ts.SyntaxKind.DoStatement ||
        node.kind === ts.SyntaxKind.CaseClause ||
        node.kind === ts.SyntaxKind.DefaultClause
    ) {
        return true;
    }
    if (node.kind === ts.SyntaxKind.Block && !parentIsFunctionLike(node)) {
        return true;
    }
    return false;
}

export function mangling(
    scopeArray: Array<Scope>,
    delimiter = BuiltinNames.moduleDelimiter,
    prefixStack: Array<string> = [],
) {
    scopeArray.forEach((scope) => {
        const currName = scope.getName();
        if (scope instanceof GlobalScope) {
            scope.startFuncName = `${currName}|start`;
            prefixStack.push(currName);

            scope.varArray.forEach((v) => {
                v.mangledName = `${prefixStack.join(delimiter)}|${v.varName}`;
            });

            scope.namedTypeMap.forEach((t, _) => {
                if (t.kind == TypeKind.INTERFACE) {
                    const infc = t as TSInterface;
                    infc.mangledName = `${prefixStack.join(delimiter)}|${
                        infc.className
                    }`;
                }
            });
        } else if (scope instanceof NamespaceScope) {
            prefixStack.push(currName);

            scope.varArray.forEach((v) => {
                v.mangledName = `${prefixStack.join(delimiter)}|${v.varName}`;
            });

            scope.namedTypeMap.forEach((t, _) => {
                if (t.kind == TypeKind.INTERFACE) {
                    const infc = t as TSInterface;
                    infc.mangledName = `${prefixStack.join(delimiter)}|${
                        infc.className
                    }`;
                }
            });
        } else if (scope instanceof FunctionScope) {
            prefixStack.push(currName);
        } else if (scope instanceof ClassScope) {
            prefixStack.push(currName);
            scope.classType.mangledName = `${prefixStack.join(delimiter)}`;
        } else if (scope instanceof BlockScope) {
            prefixStack.push(currName);
        }

        scope.mangledName = `${prefixStack.join(delimiter)}`;

        mangling(scope.children, delimiter, prefixStack);
        prefixStack.pop();
    });
}

export function getModulePath(
    declaration: ts.ImportDeclaration | ts.ExportDeclaration,
    currentGlobalScope: GlobalScope,
) {
    /* moduleSpecifier contains quotation marks, so we must slice them to get real module name */
    if (declaration.moduleSpecifier === undefined) return undefined;
    const moduleSpecifier = declaration
        .moduleSpecifier!.getText()
        .slice("'".length, -"'".length);
    const currentModuleName = currentGlobalScope.moduleName;
    const moduleName = path.relative(
        process.cwd(),
        path.resolve(path.dirname(currentModuleName), moduleSpecifier),
    );
    return moduleName;
}

export function getGlobalScopeByModuleName(
    moduleName: string,
    globalScopes: Array<GlobalScope>,
) {
    const res = globalScopes.find((s) => s.moduleName === moduleName);
    if (!res) {
        throw Error(`no such module: ${moduleName}`);
    }

    return res;
}

export function getImportIdentifierName(
    importDeclaration: ts.ImportDeclaration | ts.ExportDeclaration,
) {
    const importIdentifierArray: string[] = [];
    const nameAliasImportMap = new Map<string, string>();
    let nameScopeImportName: string | null = null;
    let defaultImportName: string | null = null;
    let importClause = undefined;
    let namedBindings = undefined;
    if (ts.isImportDeclaration(importDeclaration)) {
        importClause = importDeclaration.importClause;
        if (!importClause) {
            /** import "otherModule" */
            throw new UnimplementError(
                'TODO: importing modules with side effects',
            );
        }
        namedBindings = importClause.namedBindings;
        const importElement = importClause.name;
        if (importElement) {
            /**
             * import default export from other module
             * import module_case4_var1 from './module-case4';
             */
            const importElementName = importElement.getText();
            defaultImportName = importElementName;
        }
    } else namedBindings = importDeclaration.exportClause;

    if (namedBindings) {
        if (
            ts.isNamedImports(namedBindings) ||
            ts.isNamedExports(namedBindings)
        ) {
            /** import regular exports from other module */
            for (const importSpecifier of namedBindings.elements) {
                const specificIdentifier = <ts.Identifier>importSpecifier.name;
                const specificName = specificIdentifier.getText()!;
                const propertyIdentifier = importSpecifier.propertyName;
                if (propertyIdentifier) {
                    /** import {module_case2_var1 as a, module_case2_func1 as b} from './module-case2'; */
                    const propertyName = (<ts.Identifier>(
                        propertyIdentifier
                    )).getText()!;
                    nameAliasImportMap.set(specificName, propertyName);
                    importIdentifierArray.push(propertyName);
                } else {
                    /** import {module_case2_var1, module_case2_func1} from './module-case2'; */
                    importIdentifierArray.push(specificName);
                }
            }
        } else if (
            ts.isNamespaceImport(namedBindings) ||
            ts.isNamespaceExport(namedBindings)
        ) {
            /**
             * import entire module into a variable
             * import * as xx from './yy'
             */
            const identifier = <ts.Identifier>namedBindings.name;
            nameScopeImportName = identifier.getText()!;
        } else {
            throw Error('unexpected case');
        }
    }

    return {
        importIdentifierArray,
        nameScopeImportName,
        nameAliasImportMap,
        defaultImportName,
    };
}

export function getExportIdentifierName(
    exportDeclaration: ts.ExportDeclaration,
    curGlobalScope: GlobalScope,
    importModuleScope: GlobalScope,
) {
    const nameAliasExportMap = new Map<string, string>();
    const exportIdentifierList: Expression[] = [];
    // only need to record export alias
    const exportClause = exportDeclaration.exportClause;
    if (!exportClause) {
        throw Error('exportClause is undefined');
    }
    if (ts.isNamedExports(exportClause)) {
        const exportSpecifiers = exportClause.elements;
        for (const exportSpecifier of exportSpecifiers) {
            const specificIdentifier = <ts.Identifier>exportSpecifier.name;
            let specificName = specificIdentifier.getText()!;
            if (specificName === 'default') {
                specificName = (
                    importModuleScope!.defaultExpr as IdentifierExpression
                ).identifierName;
                curGlobalScope.addImportDefaultName(
                    specificName,
                    importModuleScope,
                );
            }
            const specificExpr = new IdentifierExpression(specificName);

            const propertyIdentifier = exportSpecifier.propertyName;
            if (propertyIdentifier) {
                const propertyExpr = new IdentifierExpression(
                    propertyIdentifier.getText(),
                );
                const propertyName = (<ts.Identifier>(
                    propertyIdentifier
                )).getText()!;
                exportIdentifierList.push(propertyExpr);
                nameAliasExportMap.set(specificName, propertyName);
            } else {
                exportIdentifierList.push(specificExpr);
            }
        }
    }

    return { nameAliasExportMap, exportIdentifierList };
}

export function getBuiltInFuncName(oriFuncName: string) {
    return BuiltinNames.builtinModuleName
        .concat(BuiltinNames.moduleDelimiter)
        .concat(oriFuncName);
}

export function getUtilsFuncName(name: string) {
    return BuiltinNames.utilsFuncName
        .concat(BuiltinNames.moduleDelimiter)
        .concat(name);
}

export interface SourceLocation {
    line: number;
    character: number;
}

export function getNodeLoc(node: ts.Node) {
    const sourceFile = node.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
    );
    // start from 1
    return { line: line + 1, character: character };
}

export function addSourceMapLoc(irNode: Statement | Expression, node: ts.Node) {
    const { line, character } = getNodeLoc(node);
    irNode.debugLoc = { line: line, character: character };
}

export function processEscape(str: string) {
    const escapes1 = ['"', "'", '\\'];
    const escapes2 = ['n', 'r', 't', 'b', 'f'];
    const appendingStr = ['\n', '\r', '\t', '\b', '\f'];
    let newStr = '';
    for (let i = 0; i < str.length; i++) {
        if (
            str[i] == '\\' &&
            i < str.length - 1 &&
            (escapes1.includes(str[i + 1]) || escapes2.includes(str[i + 1]))
        ) {
            if (escapes1.includes(str[i + 1])) {
                newStr += str[i + 1];
            } else if (escapes2.includes(str[i + 1])) {
                newStr += appendingStr[escapes2.indexOf(str[i + 1])];
            }
            i += 1;
            continue;
        }
        if (escapes1.includes(str[i]) && (i == 0 || i == str.length - 1)) {
            continue;
        }
        newStr += str[i];
    }
    return newStr;
}

/**
 * @describe create a new classScope based on classType information
 * @param originalClassScope the original ClassScope to be specialized
 * @param parent the parent of the original ClassScope
 * @param classType the new class type corresponding to specialized ClassScope: TSClass => ClassScope
 * @param newName the name of new ClassScope
 * @returns a new specialized ClassScope
 */
export function createClassScopeByClassType(
    originalClassScope: ClassScope,
    parent: Scope,
    classType: TSClass,
    newName?: string,
) {
    const newClassScope = new ClassScope(parent);
    originalClassScope.specialize(newClassScope);
    newClassScope.setGenericOwner(originalClassScope);
    const name = newName ? newName : classType.className;
    newClassScope.setName(name);
    newClassScope.setClassType(classType);

    originalClassScope.children.forEach((s) => {
        if (s.kind == ScopeKind.FunctionScope) {
            const functionScope = s as FunctionScope;
            const funcName = functionScope.getName();
            const funcKind = functionScope.funcType.funcKind;
            // constructor is not in the memberFuncs
            if (funcKind == FunctionKind.CONSTRUCTOR) {
                createFunctionScopeByFunctionType(
                    functionScope,
                    newClassScope,
                    classType.ctorType,
                );
            } else {
                let prefix = '';
                // the function names of the getter and setter contain 'get_' and 'set_' prefix strings.
                if (
                    funcKind == FunctionKind.GETTER ||
                    funcKind == FunctionKind.SETTER
                ) {
                    prefix = getMethodPrefix(funcKind);
                }
                const res = classType.memberFuncs.findIndex((f) => {
                    return (
                        funcName === prefix + f.name &&
                        functionScope.funcType.envParamLen ==
                            f.type.envParamLen &&
                        functionScope.funcType.funcKind === f.type.funcKind
                    );
                });
                if (res !== -1) {
                    const functionType = classType.memberFuncs[res].type;
                    createFunctionScopeByFunctionType(
                        functionScope,
                        newClassScope,
                        functionType,
                    );
                }
            }
        }
    });
    return newClassScope;
}

/**
 * @describe create a new FunctionScope based on functionType information
 * @param originalFunctionScope the original FunctionScope to be specialized
 * @param parent the parent of the original FunctionScope
 * @param functionType the new function type corresponding to specialized FunctionScope: TSFunction => FunctionScope
 * @param newName the name of new FunctionScope
 * @returns a new specialized FunctionScope
 */
export function createFunctionScopeByFunctionType(
    originalFunctionScope: FunctionScope,
    parent: Scope,
    functionType: TSFunction,
    newName?: string,
) {
    const newFuncScope = new FunctionScope(parent);
    const className = parent instanceof ClassScope ? parent.className : '';
    newFuncScope.setClassName(className);
    const name = newName ? newName : originalFunctionScope.funcName;
    newFuncScope.setFuncName(name);
    newFuncScope.envParamLen = originalFunctionScope.envParamLen;
    newFuncScope.setGenericOwner(originalFunctionScope);

    // specialize local variables inside functions
    originalFunctionScope.varArray.forEach((v, index) => {
        if (v.varName == '@context') {
            const context = newFuncScope.findVariable('@context') as Variable;
            context.setVarIndex(v.varIndex);
            context.scope = newFuncScope;
        } else {
            const varType = v.varType;
            const new_var = new Variable(
                v.varName,
                varType,
                [],
                v.varIndex,
                v.isLocalVar(),
                v.initExpression,
            );
            new_var.scope = newFuncScope;
            newFuncScope.addVariable(new_var);
        }
    });
    newFuncScope.setFuncType(functionType);
    functionType.setBelongedScope(newFuncScope);
    return newFuncScope;
}

/* Check if the type, and all of its children contains generic type */
export function isTypeGeneric(type: Type): boolean {
    switch (type.kind) {
        case TypeKind.VOID:
        case TypeKind.BOOLEAN:
        case TypeKind.NUMBER:
        case TypeKind.ANY:
        case TypeKind.UNDEFINED:
        case TypeKind.STRING:
        case TypeKind.UNKNOWN:
        case TypeKind.NULL:
        case TypeKind.WASM_I32:
        case TypeKind.WASM_I64:
        case TypeKind.WASM_F32:
        case TypeKind.WASM_F64:
        case TypeKind.WASM_ANYREF: {
            return false;
        }
        case TypeKind.UNION: {
            const unionType = type as TSUnion;
            return unionType.types.some((t) => {
                return isTypeGeneric(t);
            });
        }
        case TypeKind.ARRAY: {
            return isTypeGeneric((type as TSArray).elementType);
        }
        case TypeKind.FUNCTION: {
            const funcType = type as TSFunction;
            /* Member functions do not have 'typeArguments' property.
             * So when a function is a member function of a class,
             * it is determined whether the function is a generic type by judging whether the class it belongs to is a generic type.
             * The result is not always correct, but it does not affect the logic of specialization.
             *
             * e.g.
             *  class A<T> {
             *      a: T;
             *      echo() {
             *          console.log('hello world');
             *      }
             *  }
             *
             * 'A' is a generic class type, and at this time we will treat 'echo' as a generic function.
             */
            if (
                (funcType.isMethod && funcType.belongedClass?.typeArguments) ||
                funcType.typeArguments
            )
                return true;
            return false;
        }
        case TypeKind.CLASS:
        case TypeKind.INTERFACE: {
            const classType = type as TSClass;
            if (classType.typeArguments) return true;
            return false;
        }
        case TypeKind.TYPE_PARAMETER: {
            return true;
        }
        default: {
            throw new UnimplementError('Not implemented type: ${type}');
        }
    }
    return false;
}

export enum PredefinedTypeId {
    VOID = 1,
    UNDEFINED,
    NULL,
    NEVER,
    INT,
    NUMBER,
    BOOLEAN,
    RAW_STRING,
    STRING,
    ANY,
    UNION,
    GENERIC,
    NAMESPACE,
    CLOSURECONTEXT,
    EMPTY,
    ARRAY,
    ARRAY_CONSTRUCTOR,
    STRING_OBJECT,
    STRING_CONSTRUCTOR,
    MAP,
    MAP_CONSTRUCTOR,
    SET,
    SET_CONSTRUCTOR,
    FUNCTION,
    PROMISE,
    PROMISE_CONSTRUCTOR,
    DATE,
    DATE_CONSTRUCTOR,
    FUNC_VOID_VOID_NONE,
    FUNC_VOID_VOID_DEFAULT,
    FUNC_VOID_ARRAY_ANY_DEFAULT,
    FUNC_ANY_ARRAY_ANY_DEFAULT,
    FUNC_VOID_VOID_METHOD,
    FUNC_VOID_ARRAY_ANY_METHOD,
    FUNC_ANY_ARRAY_ANY_METHOD,
    ARRAY_ANY,
    ARRAY_INT,
    ARRAY_NUMBER,
    ARRAY_BOOLEAN,
    ARRAY_STRING,
    SET_ANY,
    SET_INT,
    SET_NUMBER,
    SET_BOOLEAN,
    SET_STRING,
    MAP_STRING_STRING,
    MAP_STRING_ANY,
    MAP_INT_STRING,
    MAP_INT_ANY,
    ERROR,
    ERROR_CONSTRUCTOR,
    BUILTIN_TYPE_BEGIN,

    CUSTOM_TYPE_BEGIN = BUILTIN_TYPE_BEGIN + 1000,
}
export const DefaultTypeId = -1;
export const CustomTypeId = PredefinedTypeId.CUSTOM_TYPE_BEGIN;
