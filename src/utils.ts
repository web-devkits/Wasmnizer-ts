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
import { ParserContext } from './frontend.js';
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
    builtinTypes,
    builtinWasmTypes,
    TypeResolver,
    TSTypeWithArguments,
} from './type.js';
import { UnimplementError } from './error.js';
import { Statement } from './statement.js';
import { Logger } from './log.js';

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

export enum CommentKind {
    NativeSignature = 'NativeSignature',
    Import = 'Import',
    Export = 'Export',
}

export interface NativeSignature {
    paramTypes: Type[];
    returnType: Type;
}

export interface Import {
    moduleName: string;
    funcName: string;
}

export interface Export {
    exportName: string;
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
        const currName = convertWindowsPath(scope.getName());
        if (scope instanceof GlobalScope) {
            scope.startFuncName = `${currName}|start`;
            prefixStack.push(currName);

            scope.varArray.forEach((v) => {
                v.mangledName = `${prefixStack.join(delimiter)}|${v.varName}`;
            });

            scope.namedTypeMap.forEach((t, _) => {
                if (t.kind == TypeKind.INTERFACE) {
                    const infc = t as TSInterface;
                    if (infc.mangledName == '') {
                        infc.mangledName = `${prefixStack.join(delimiter)}|${
                            infc.className
                        }`;
                    }
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

// The character '\' in the string got from API getText is not treated
// as a escape character.
/**
 * @describe process escapes in a string
 * @param str the raw string got from API getText
 * @returns a new str
 */
export function processEscape(str: string) {
    const escapes1 = ['"', "'", '\\'];
    const escapes2 = ['n', 'r', 't', 'b', 'f'];
    const appendingStr = ['\n', '\r', '\t', '\b', '\f'];
    let newStr = '';
    let code: string;
    for (let i = 0; i < str.length; i++) {
        if (str[i] == '\\' && i < str.length - 1) {
            if (escapes1.includes(str[i + 1])) {
                // binaryen will generate escape automaticlly for characters in escapes1
                newStr += str[i + 1];
            } else if (escapes2.includes(str[i + 1])) {
                newStr += appendingStr[escapes2.indexOf(str[i + 1])];
            } else if (str[i + 1] == 'x') {
                code = decimalizationInternal(str.substring(i + 2, i + 4), 16);
                newStr += String.fromCharCode(parseFloat(code));
                i += 2;
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

function decimalizationInternal(value: string, systemNumeration: number) {
    let decimal = 0;
    let num = 0;
    let code = 0;
    for (let i = 0; i < value.length; i++) {
        code = value[i].charCodeAt(0);
        if (code >= 65 && code <= 70) num = 10 + code - 65;
        else if (code >= 97 && code <= 102) num = 10 + code - 97;
        else if (code >= 48 && code <= 59) num = parseFloat(value[i]);
        decimal = decimal * systemNumeration + num;
    }
    return decimal.toString();
}

export function genericFunctionSpecialization(
    genericFuncType: TSFunction,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): TSFunction {
    if (
        !genericFuncType.typeArguments ||
        typeArguments.length == 0 ||
        typeParameters.length == 0
    )
        return genericFuncType;

    const typeArgumentsSignature: Array<string> = [];
    const _typeParameters = genericFuncType.typeArguments!;
    _typeParameters.forEach((type) => {
        const index = typeParameters.findIndex((t) => {
            return t.name === type.name;
        });
        if (index == -1) {
            throw new UnimplementError(
                `${type.name} not found in typeParameters`,
            );
        }
        typeArgumentsSignature.push(`${typeArguments[index].kind}`);
    });

    const genericOwner = genericFuncType.genericOwner
        ? genericFuncType.genericOwner
        : genericFuncType;
    const typeSignature =
        typeArgumentsSignature.length > 0
            ? '<' + typeArgumentsSignature.join(',') + '>'
            : '';
    const cache = TypeResolver.specializedTypeCache.get(genericOwner);
    let found: Type | undefined;
    if (cache) {
        cache.forEach((v) => {
            if (v.has(typeSignature)) {
                found = v.get(typeSignature);
            }
        });
    }
    if (found) return found as TSFunction;

    const funcType = genericFuncType as TSFunction;
    const newFuncType = funcType.clone();
    // specialized function does not have typeArguments
    newFuncType.setTypeParameters(undefined);
    // specialized function type need to reset belongedClass and belongedScope
    newFuncType.belongedClass = undefined;
    newFuncType.setBelongedScope(undefined);

    // regenerate the parameter list
    newFuncType.setParamTypes([]);
    funcType.getParamTypes().forEach((paramType) => {
        const newParamType = genericTypeSpecialization(
            paramType,
            typeArguments,
            typeParameters,
            context,
        );
        newFuncType.addParamType(newParamType);
    });
    newFuncType.setGenericOwner(genericOwner);

    // update specializedTypeCache
    newFuncType.setSpecializedArguments(typeArguments);
    if (TypeResolver.specializedTypeCache.has(genericOwner)) {
        const value = new Map();
        value.set(typeSignature, newFuncType);
        TypeResolver.specializedTypeCache.get(genericOwner)!.push(value);
    } else {
        const value = new Map();
        value.set(typeSignature, newFuncType);
        TypeResolver.specializedTypeCache.set(genericOwner, [value]);
    }

    newFuncType.returnType = genericTypeSpecialization(
        funcType.returnType,
        typeArguments,
        typeParameters,
        context,
    );
    return newFuncType;
}

export function genericClassMethodSpecialization(
    genericMethodType: TSFunction,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): TSFunction {
    if (typeArguments.length == 0 || typeParameters.length == 0)
        return genericMethodType;

    const typeArgumentsSignature: Array<string> = [];
    const _typeParameters = genericMethodType.typeArguments
        ? genericMethodType.typeArguments
        : genericMethodType.belongedClass!.typeArguments!;
    _typeParameters.forEach((type) => {
        const index = typeParameters.findIndex((t) => {
            return t.name === type.name;
        });
        if (index == -1) {
            throw new UnimplementError(
                `${type.name} not found in typeParameters`,
            );
        }
        typeArgumentsSignature.push(`${typeArguments[index].kind}`);
    });

    const genericOwner = genericMethodType.genericOwner
        ? genericMethodType.genericOwner
        : genericMethodType;
    const newMethodType = genericMethodType.clone();
    // specialized function does not have typeArguments
    newMethodType.setTypeParameters(undefined);
    // specialized function type need to reset belongedClass and belongedScope
    newMethodType.belongedClass = undefined;
    newMethodType.setBelongedScope(undefined);

    // regenerate the parameter list
    newMethodType.setParamTypes([]);
    genericMethodType.getParamTypes().forEach((paramType) => {
        const newParamType = genericTypeSpecialization(
            paramType,
            typeArguments,
            typeParameters,
            context,
        );
        newMethodType.addParamType(newParamType);
    });
    newMethodType.setGenericOwner(genericOwner);

    // update specializedTypeCache
    if (genericMethodType.typeArguments) {
        newMethodType.setSpecializedArguments(typeArguments);
    }

    // prevent infinite recursive call
    if (
        genericMethodType.funcKind == FunctionKind.CONSTRUCTOR ||
        (genericMethodType.returnType instanceof TSClass &&
            genericMethodType.returnType.toString ===
                genericMethodType.belongedClass!.toString)
    )
        return newMethodType;

    newMethodType.returnType = genericTypeSpecialization(
        genericMethodType.returnType,
        typeArguments,
        typeParameters,
        context,
    );
    return newMethodType;
}

/**
 *  class A {
 *      a: number;
 *      echo<T>(param: T) {...};
 *  }
 *  const a = new A();
 *  this class type does not contain 'typeParameters'.
 */
export function genericMethodSpecialization(
    genericMethodType: TSFunction,
    typeArguments: Type[],
    context: ParserContext,
) {
    const classType = genericMethodType.belongedClass;
    const originalFunctionScope = genericMethodType.belongedScope;
    const typeParameters = genericMethodType.typeArguments;

    // insufficient information used for specialization
    if (!classType || !typeParameters || !originalFunctionScope) return;

    const typeNames = new Array<string>();
    typeArguments.forEach((v) => {
        typeNames.push(`${v.kind}`);
    });
    const typeSignature = '<' + typeNames.join(',') + '>';
    const newFuncName = originalFunctionScope.getName() + typeSignature;
    const specializedFunctionType = genericClassMethodSpecialization(
        genericMethodType,
        typeArguments,
        typeParameters,
        context,
    ) as TSFunction;
    specializedFunctionType.belongedClass = classType;

    // create new function scope begin
    const newFuncScope = new FunctionScope(originalFunctionScope.parent!);
    originalFunctionScope.specialize(newFuncScope);
    newFuncScope.setClassName(classType.className);
    newFuncScope.setFuncName(newFuncName);
    newFuncScope.setFuncType(specializedFunctionType);
    specializedFunctionType.setBelongedScope(newFuncScope);
    if (originalFunctionScope.mangledName !== '') {
        const genericMangledName = originalFunctionScope.mangledName;
        const reverse = genericMangledName.split('|').reverse();
        // class name
        reverse[0] = newFuncName;
        newFuncScope.mangledName = reverse.reverse().join('|');
    }
    newFuncScope.setGenericOwner(originalFunctionScope);
    originalFunctionScope.addSpecializedScope(typeSignature, newFuncScope);
    const optional = classType.getMethod(originalFunctionScope.getName())
        .method!.optional;
    classType.addMethod({
        name: newFuncName,
        type: specializedFunctionType,
        optional: optional,
    });
    classType.overrideOrOwnMethods.add(newFuncName);

    // specialize a generic member function on the inheritance chain
    const drivedClasses = classType.getDrivedClasses();
    if (!drivedClasses) return;
    drivedClasses.forEach((c) => {
        if (c.memberFuncs.length > 0) {
            c.memberFuncs.forEach((m) => {
                genericMethodSpecialization(m.type, typeArguments, context);
            });
        }
    });
}

export function genericClassSpecialization(
    genericClassType: TSClass,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): TSClass {
    if (typeArguments.length == 0 || typeParameters.length == 0)
        return genericClassType;

    const typeArgumentsSignature: Array<string> = [];
    const _typeParameters = genericClassType.typeArguments;
    if (_typeParameters) {
        _typeParameters.forEach((type) => {
            const index = typeParameters.findIndex((t) => {
                return t.name === type.name;
            });
            if (index == -1) {
                throw new UnimplementError(
                    `${type.name} not found in typeParameters`,
                );
            }
            typeArgumentsSignature.push(`${typeArguments[index].kind}`);
        });
    }

    const genericOwner = genericClassType.genericOwner
        ? genericClassType.genericOwner
        : genericClassType;
    const typeSignature =
        typeArgumentsSignature.length > 0
            ? '<' + typeArgumentsSignature.join(',') + '>'
            : '';
    const cache = TypeResolver.specializedTypeCache.get(genericOwner);
    let found: Type | undefined;
    if (cache) {
        cache.forEach((v) => {
            if (v.has(genericClassType.className + typeSignature)) {
                found = v.get(genericClassType.className + typeSignature);
            }
        });
    }
    if (found) return found as TSClass;

    /**
     * class Base<T> {
     *     x: T;
     *     action(param: T) {....}
     * }
     */
    if (genericClassType.typeArguments) {
        let newClassType: TSClass;
        if (genericClassType.kind === TypeKind.CLASS) {
            newClassType = new TSClass();
        } else {
            newClassType = new TSInterface();
        }
        const specializedName = genericClassType.className + typeSignature;
        newClassType.setClassName(specializedName);
        if (genericClassType.mangledName !== '') {
            const genericMangledName = genericClassType.mangledName;
            const reverse = genericMangledName.split('|').reverse();
            reverse[0] = specializedName;
            newClassType.mangledName = reverse.reverse().join('|');
        }
        newClassType.setGenericOwner(genericOwner as TSTypeWithArguments);
        newClassType.setSpecializedArguments(typeArguments);
        newClassType.hasDeclareCtor = genericClassType.hasDeclareCtor;
        newClassType.isDeclare = genericClassType.isDeclare;
        newClassType.isLiteral = genericClassType.isLiteral;
        newClassType.overrideOrOwnMethods =
            genericClassType.overrideOrOwnMethods;
        newClassType.traverseStatus = genericClassType.traverseStatus;

        // update specializedTypeCache
        if (TypeResolver.specializedTypeCache.has(genericOwner)) {
            const value = new Map();
            value.set(specializedName, newClassType);
            TypeResolver.specializedTypeCache.get(genericOwner)!.push(value);
        } else {
            const value = new Map();
            value.set(specializedName, newClassType);
            TypeResolver.specializedTypeCache.set(genericOwner, [value]);
        }

        // base class type
        if (genericClassType.getBase()) {
            let baseType = genericClassType.getBase();
            if (baseType) {
                if (isTypeGeneric(baseType)) {
                    baseType = genericTypeSpecialization(
                        baseType,
                        typeArguments,
                        typeParameters,
                        context,
                    ) as TSClass;
                }
                newClassType.setBase(baseType);
            }
        }

        const implInfc = genericClassType.getImplInfc();
        if (implInfc && isTypeGeneric(implInfc)) {
            const newInfcType = genericTypeSpecialization(
                implInfc,
                typeArguments,
                typeParameters,
                context,
            ) as TSInterface;
            newClassType.setImplInfc(newInfcType);
        } else {
            newClassType.setImplInfc(implInfc);
        }

        // specialized member variables
        genericClassType.fields.forEach((field) => {
            const newFieldType = genericTypeSpecialization(
                field.type,
                typeArguments,
                typeParameters,
                context,
            );
            newClassType.addMemberField({
                name: field.name,
                type: newFieldType,
            });
        });
        // specialized member functions
        genericClassType.memberFuncs.forEach((func) => {
            const funcName = func.name;
            const funcKind = func.type.funcKind;
            let realFuncName = funcName;
            if (funcKind == FunctionKind.GETTER) {
                realFuncName = 'get_' + funcName;
            } else if (funcKind == FunctionKind.SETTER) {
                realFuncName = 'set_' + funcName;
            }
            const isOwnMethod =
                newClassType.overrideOrOwnMethods.has(realFuncName);
            if (isOwnMethod) {
                const newFuncType = genericClassMethodSpecialization(
                    func.type,
                    typeArguments,
                    typeParameters,
                    context,
                ) as TSFunction;
                newFuncType.belongedClass = newClassType;
                newClassType.addMethod({
                    name: funcName,
                    type: newFuncType,
                });
            } else {
                let base = newClassType.getBase();
                let found = func;
                while (base) {
                    const isOwnMethod =
                        base.overrideOrOwnMethods.has(realFuncName);
                    if (isOwnMethod) {
                        base.memberFuncs.forEach((f) => {
                            if (
                                f.name == funcName &&
                                f.type.funcKind == funcKind
                            ) {
                                found = f;
                                return;
                            }
                        });
                        break;
                    }
                    base = base.getBase();
                }
                newClassType.addMethod(found);
            }
        });
        genericClassType.staticFields.forEach((field) => {
            const newStaticFieldType = genericTypeSpecialization(
                field.type,
                typeArguments,
                typeParameters,
                context,
            );
            if (newStaticFieldType instanceof TSTypeWithArguments)
                newClassType.addStaticMemberField({
                    name: field.name,
                    type: newStaticFieldType,
                });
        });
        // specialized constructor
        if (genericClassType.ctorType) {
            const newCtor = genericClassMethodSpecialization(
                genericClassType.ctorType,
                typeArguments,
                typeParameters,
                context,
            ) as TSFunction;
            newCtor.belongedClass = newClassType;
            newClassType.ctorType = newCtor;
            newClassType.ctorType.returnType = newClassType;
        }

        if (genericClassType.belongedScope)
            genericClassType.belongedScope.parent?.addType(
                newClassType.className,
                newClassType,
            );
        return newClassType;
    } else {
        /**
         * class Base {
         *     x: number;
         *     action(param: T) {....}
         * }
         */
        genericClassType.memberFuncs.forEach((func) => {
            if (isTypeGeneric(func.type)) {
                const genericFuncType = func.type;
                const genericFunctionScope = genericFuncType.belongedScope!;
                // generate the name of the specialized function name
                const typeNames = new Array<string>();
                typeArguments.forEach((v) => {
                    if (v.kind !== TypeKind.TYPE_PARAMETER)
                        typeNames.push(`${v.kind}`);
                });
                const typeSignature =
                    typeNames.length > 0 ? '<' + typeNames.join(',') + '>' : '';
                const genericFunctionScopeName = genericFunctionScope.getName();
                const specializedFunctionScopeName =
                    genericFunctionScopeName + typeSignature;
                // whether the specialized generic method already exists
                const existMethod = genericClassType.getMethod(
                    specializedFunctionScopeName,
                );
                if (existMethod.method) return genericClassType;

                genericMethodSpecialization(
                    genericFuncType,
                    typeArguments,
                    context,
                );
            }
        });
        return genericClassType;
    }
}

/**
 * @describe specialize a generic type
 * @param genericType the generic type that need to be specialized
 * @param typeArguments specialized type arguments list
 * @param typeParameters generic parameter type list
 * @returns a new specialized type，if the same specialization is executed for the second time,
 *          generictype is returned to prevent the scope from being created again.
 */
export function genericTypeSpecialization(
    genericType: Type,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): Type {
    // the type that need to be specialized must be generic
    if (!isTypeGeneric(genericType)) return genericType;

    switch (genericType.kind) {
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
            return genericType;
        }
        case TypeKind.ARRAY: {
            return new TSArray(
                genericTypeSpecialization(
                    (genericType as TSArray).elementType,
                    typeArguments,
                    typeParameters,
                    context,
                ),
            );
        }
        case TypeKind.UNION: {
            const unionType = genericType as TSUnion;
            const newUnion = new TSUnion();
            unionType.types.forEach((t) => {
                if (t.kind == TypeKind.UNDEFINED) {
                    newUnion.addType(t);
                } else {
                    const newType = genericTypeSpecialization(
                        t,
                        typeArguments,
                        typeParameters,
                        context,
                    );
                    newUnion.addType(newType);
                }
            });
            return newUnion;
        }
        case TypeKind.FUNCTION: {
            const newFuncType = genericFunctionSpecialization(
                genericType as TSFunction,
                typeArguments,
                typeParameters,
                context,
            );
            return newFuncType;
        }
        case TypeKind.CLASS:
        case TypeKind.INTERFACE: {
            const newClassType = genericClassSpecialization(
                genericType as TSClass,
                typeArguments,
                typeParameters,
                context,
            );
            return newClassType;
        }
        case TypeKind.TYPE_PARAMETER: {
            const gType = genericType as TSTypeParameter;
            if (typeArguments && typeParameters) {
                for (let i = 0; i < typeParameters.length; i++) {
                    if (typeParameters[i].name === gType.name) {
                        return typeArguments[i];
                    }
                }
            }
            return builtinTypes.get('any')!;
        }
        default: {
            throw new UnimplementError(
                `Not implemented type: ${genericType.kind}`,
            );
        }
    }
}

export function genericFuncTransformation(
    genericFuncType: TSFunction,
    newTypeParameters: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): TSFunction {
    if (
        !genericFuncType.typeArguments ||
        newTypeParameters.length == 0 ||
        typeParameters.length == 0
    )
        return genericFuncType;

    const genericOwner = genericFuncType.genericOwner
        ? genericFuncType.genericOwner
        : genericFuncType;
    const newFuncType = genericFuncType.clone();
    newFuncType.setBelongedScope(undefined);
    newFuncType.setGenericOwner(genericOwner);
    newFuncType.setSpecializedArguments(newTypeParameters);

    // regenerate typeParameters
    newFuncType.setTypeParameters([]);
    genericFuncType.typeArguments.forEach((t) => {
        newFuncType.addTypeParameter(
            genericTypeTransformation(
                t,
                newTypeParameters,
                typeParameters,
                context,
            ) as TSTypeParameter,
        );
    });
    // regenerate the parameter list
    newFuncType.setParamTypes([]);
    genericFuncType.getParamTypes().forEach((paramType) => {
        const newParamType = genericTypeTransformation(
            paramType,
            newTypeParameters,
            typeParameters,
            context,
        );
        newFuncType.addParamType(newParamType);
    });
    newFuncType.returnType = genericTypeTransformation(
        genericFuncType.returnType,
        newTypeParameters,
        typeParameters,
        context,
    );
    return newFuncType;
}

export function genericMethodTransformation(
    genericMethodType: TSFunction,
    newTypeParameters: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): TSFunction {
    if (newTypeParameters.length == 0 || typeParameters.length == 0)
        return genericMethodType;

    const genericOwner = genericMethodType.genericOwner
        ? genericMethodType.genericOwner
        : genericMethodType;
    const newMethodType = genericMethodType.clone();
    newMethodType.setBelongedScope(undefined);
    newMethodType.setGenericOwner(genericOwner);

    // regenerate the parameter list
    newMethodType.setParamTypes([]);
    genericMethodType.getParamTypes().forEach((paramType) => {
        const newParamType = genericTypeTransformation(
            paramType,
            newTypeParameters,
            typeParameters,
            context,
        );
        newMethodType.addParamType(newParamType);
    });

    // prevent infinite recursive call
    if (
        genericMethodType.funcKind == FunctionKind.CONSTRUCTOR ||
        (genericMethodType.returnType instanceof TSClass &&
            genericMethodType.returnType.toString ===
                genericMethodType.belongedClass!.toString)
    )
        return newMethodType;

    newMethodType.returnType = genericTypeTransformation(
        genericMethodType.returnType,
        newTypeParameters,
        typeParameters,
        context,
    );
    return newMethodType;
}

export function genericClassTransformation(
    genericClassType: TSClass,
    newTypeParameters: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
    namePrefix?: string,
): TSClass {
    if (
        !genericClassType.typeArguments ||
        newTypeParameters.length == 0 ||
        typeParameters.length == 0
    )
        return genericClassType;

    const genericOwner = genericClassType.genericOwner
        ? genericClassType.genericOwner
        : genericClassType;
    if (genericClassType.typeArguments) {
        let newClassType: TSClass;
        if (genericClassType.kind === TypeKind.CLASS) {
            newClassType = new TSClass();
        } else {
            newClassType = new TSInterface();
        }
        newClassType.hasDeclareCtor = genericClassType.hasDeclareCtor;
        newClassType.isDeclare = genericClassType.isDeclare;
        newClassType.isLiteral = genericClassType.isLiteral;
        newClassType.overrideOrOwnMethods =
            genericClassType.overrideOrOwnMethods;
        newClassType.traverseStatus = genericClassType.traverseStatus;
        const newClassName = namePrefix
            ? namePrefix + '_' + genericClassType.className
            : genericClassType.className;
        newClassType.setClassName(newClassName);
        newClassType.setGenericOwner(genericOwner as TSClass);
        newClassType.setSpecializedArguments(newTypeParameters);

        // regenerate typeParameters
        newClassType.setTypeParameters([]);
        genericClassType.typeArguments!.forEach((t) => {
            newClassType.addTypeParameter(
                genericTypeTransformation(
                    t,
                    newTypeParameters,
                    typeParameters,
                    context,
                ) as TSTypeParameter,
            );
        });

        // base class type
        if (genericClassType.getBase()) {
            let baseType = genericClassType.getBase();
            if (baseType) {
                if (isTypeGeneric(baseType)) {
                    baseType = genericClassTransformation(
                        baseType,
                        newTypeParameters,
                        typeParameters,
                        context,
                        namePrefix ? namePrefix : undefined,
                    ) as TSClass;
                }
                newClassType.setBase(baseType);
            }
        }

        const implInfc = genericClassType.getImplInfc();
        if (implInfc && isTypeGeneric(implInfc)) {
            const newInfcType = genericTypeTransformation(
                implInfc,
                newTypeParameters,
                typeParameters,
                context,
            ) as TSInterface;
            newClassType.setImplInfc(newInfcType);
        } else {
            newClassType.setImplInfc(implInfc);
        }

        genericClassType.fields.forEach((field) => {
            const newFieldType = genericTypeTransformation(
                field.type,
                newTypeParameters,
                typeParameters,
                context,
            );
            newClassType.addMemberField({
                name: field.name,
                type: newFieldType,
            });
        });
        genericClassType.memberFuncs.forEach((func) => {
            const funcName = func.name;
            const funcKind = func.type.funcKind;
            let realFuncName = funcName;
            if (funcKind == FunctionKind.GETTER) {
                realFuncName = 'get_' + funcName;
            } else if (funcKind == FunctionKind.SETTER) {
                realFuncName = 'set_' + funcName;
            }
            const isOwnMethod =
                newClassType.overrideOrOwnMethods.has(realFuncName);
            if (isOwnMethod) {
                const newFuncType = genericMethodTransformation(
                    func.type,
                    newTypeParameters,
                    typeParameters,
                    context,
                ) as TSFunction;
                newFuncType.belongedClass = newClassType;
                newClassType.addMethod({
                    name: funcName,
                    type: newFuncType,
                });
            } else {
                let base = newClassType.getBase();
                let found = func;
                while (base) {
                    const isOwnMethod =
                        base.overrideOrOwnMethods.has(realFuncName);
                    if (isOwnMethod) {
                        base.memberFuncs.forEach((f) => {
                            if (
                                f.name == funcName &&
                                f.type.funcKind == funcKind
                            ) {
                                found = f;
                                return;
                            }
                        });
                        break;
                    }
                    base = base.getBase();
                }
                newClassType.addMethod(found);
            }
        });
        genericClassType.staticFields.forEach((field) => {
            const newStaticFieldType = genericTypeTransformation(
                field.type,
                newTypeParameters,
                typeParameters,
                context,
            );
            if (newStaticFieldType instanceof TSTypeWithArguments)
                newClassType.addStaticMemberField({
                    name: field.name,
                    type: newStaticFieldType,
                });
        });
        if (genericClassType.ctorType) {
            const newCtor = genericMethodTransformation(
                genericClassType.ctorType,
                newTypeParameters,
                typeParameters,
                context,
            ) as TSFunction;
            newCtor.belongedClass = newClassType;
            newClassType.ctorType = newCtor;
            newClassType.ctorType.returnType = newClassType;
        }

        if (genericClassType.belongedScope) {
            const typeNames = new Array<string>();
            newTypeParameters.forEach((v) => {
                typeNames.push(`${(v as TSTypeParameter).name}`);
            });
            const typeSignature = '<' + typeNames.join(',') + '>';
            genericClassType.belongedScope.parent?.addType(
                newClassType.className + typeSignature,
                newClassType,
            );
        }
        return newClassType;
    }
    return genericClassType;
}

/**
 * @describe update the type parameters of the generic type, and return a new generic type
 * @param genericType the generic type that need to update type parameter list
 * @param newTypeParameters target parameter type list
 * @param typeParameters generic parameter type list
 * @param context the parser context
 * @returns a new generic type
 */
export function genericTypeTransformation(
    genericType: Type,
    newTypeParameters: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): Type {
    // the type that need to be update must be generic
    if (!isTypeGeneric(genericType)) return genericType;

    switch (genericType.kind) {
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
            return genericType;
        }
        case TypeKind.ARRAY: {
            return new TSArray(
                genericTypeTransformation(
                    (genericType as TSArray).elementType,
                    newTypeParameters,
                    typeParameters,
                    context,
                ),
            );
        }
        case TypeKind.UNION: {
            const unionType = genericType as TSUnion;
            const newUnion = new TSUnion();
            unionType.types.forEach((t) => {
                if (t.kind == TypeKind.UNDEFINED) {
                    newUnion.addType(t);
                } else {
                    const newType = genericTypeTransformation(
                        t,
                        newTypeParameters,
                        typeParameters,
                        context,
                    );
                    newUnion.addType(newType);
                }
            });
            return newUnion;
        }
        case TypeKind.FUNCTION: {
            const newFuncType = genericFuncTransformation(
                genericType as TSFunction,
                newTypeParameters,
                typeParameters,
                context,
            );
            return newFuncType;
        }
        case TypeKind.CLASS:
        case TypeKind.INTERFACE: {
            const newClassType = genericClassTransformation(
                genericType as TSClass,
                newTypeParameters,
                typeParameters,
                context,
            );
            return newClassType;
        }
        case TypeKind.TYPE_PARAMETER: {
            const gType = genericType as TSTypeParameter;
            if (newTypeParameters && typeParameters) {
                for (let i = 0; i < typeParameters.length; i++) {
                    if (typeParameters[i].name === gType.name) {
                        return newTypeParameters[i];
                    }
                }
            }
            return builtinTypes.get('any')!;
        }
        default: {
            throw new UnimplementError(
                `Not implemented type: ${genericType.kind}`,
            );
        }
    }
}

/**
 * @describe specialize a generic type, or update the parameter type list of this generic type
 * @param genericType the generic type that need to be processed
 * @param typeArguments specialized type arguments list
 * @param typeParameters generic parameter type list
 * @param context the parser context
 * @returns a new type
 */
export function processGenericType(
    genericType: Type,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
): Type {
    if (
        !isTypeGeneric(genericType) ||
        typeArguments.length == 0 ||
        typeParameters.length == 0
    )
        return genericType;

    if (genericType instanceof TSUnion) {
        const newUnionType = new TSUnion();
        genericType.types.forEach((t) => {
            newUnionType.addType(
                processGenericType(t, typeArguments, typeParameters, context),
            );
        });
        return newUnionType;
    }
    if (genericType instanceof TSArray) {
        const newArrayType = new TSArray(
            processGenericType(
                genericType.elementType,
                typeArguments,
                typeParameters,
                context,
            ),
        );
        return newArrayType;
    }

    let newType: Type = genericType;
    // if updating the parameter type list
    const isUpdateTypeParameters =
        typeArguments.filter((type) => isTypeGeneric(type)).length ==
        typeArguments.length;
    if (isUpdateTypeParameters) {
        // determine whether typeArguments is equal to typeParameters
        let isSame = true;
        for (let i = 0; i < typeParameters.length; i++) {
            if (
                typeParameters[i].name !==
                (typeArguments[i] as TSTypeParameter).name
            ) {
                isSame = false;
            }
        }
        if (!isSame)
            newType = genericTypeTransformation(
                genericType,
                typeArguments,
                typeParameters,
                context,
            );
    } else {
        if (genericType instanceof TSTypeWithArguments) {
            const typeArgumentsSignature: Array<string> = [];
            const _typeParameters = genericType.typeArguments;
            if (_typeParameters) {
                _typeParameters.forEach((type) => {
                    const index = typeParameters.findIndex((t) => {
                        return t.name === type.name;
                    });
                    if (index == -1) {
                        throw new UnimplementError(
                            `${type.name} not found in typeParameters`,
                        );
                    }
                    typeArgumentsSignature.push(`${typeArguments[index].kind}`);
                });
            }

            const genericOwner = genericType.genericOwner
                ? genericType.genericOwner
                : genericType;
            const typeSignature =
                typeArgumentsSignature.length > 0
                    ? '<' + typeArgumentsSignature.join(',') + '>'
                    : '';
            const cache = TypeResolver.specializedTypeCache.get(genericOwner);
            let found: Type | undefined;
            if (cache) {
                cache.forEach((v) => {
                    if (v.has(typeSignature)) {
                        found = v.get(typeSignature);
                    }
                });
            }
            if (found) return found;
        }
        newType = genericTypeSpecialization(
            genericType,
            typeArguments,
            typeParameters,
            context,
        );
        if (genericType instanceof TSTypeWithArguments) {
            const genericOwner = genericType.genericOwner
                ? genericType.genericOwner
                : genericType;
            if (genericOwner.belongedScope)
                createScopeBySpecializedType(
                    newType as TSTypeWithArguments,
                    genericOwner.belongedScope.parent!,
                    context,
                );
        }
    }
    return newType;
}

export function createScopeBySpecializedType(
    specializeType: TSTypeWithArguments,
    parentScope: Scope,
    context: ParserContext,
) {
    const genericOwner = specializeType.genericOwner;
    if (!genericOwner) return;

    const genericScope = genericOwner.belongedScope;
    if (!genericScope) return;

    switch (genericScope.kind) {
        case ScopeKind.ClassScope: {
            createClassScope(specializeType as TSClass, parentScope, context);
            break;
        }
        case ScopeKind.FunctionScope: {
            createFunctionScope(
                specializeType as TSFunction,
                parentScope,
                context,
            );
            break;
        }
        default:
            return;
    }
}

/**
 * @describe create a new specialized classScope
 * @param specializedClassType the specialized class type
 * @param parentScope the parent scope
 * @param context the parser context
 * @returns a new specialized ClassScope
 */
function createClassScope(
    specializedClassType: TSClass,
    parentScope: Scope,
    context: ParserContext,
) {
    const genericClassType = specializedClassType.genericOwner;
    if (
        !genericClassType ||
        (genericClassType && !genericClassType.belongedScope) ||
        !specializedClassType.specializedArguments
    )
        return;

    const genericClassScope = genericClassType.belongedScope! as ClassScope;
    const name = specializedClassType.className;
    // check if a specialized scope already exists
    if (
        genericClassScope.specializedScopes &&
        genericClassScope.specializedScopes.has(name)
    )
        return;

    const newClassScope = new ClassScope(parentScope);
    genericClassScope.specialize(newClassScope);
    newClassScope.setName(name);

    newClassScope.setGenericOwner(genericClassScope);
    genericClassScope.addSpecializedScope(name, newClassScope);
    newClassScope.setClassType(specializedClassType);
    specializedClassType.setBelongedScope(newClassScope);

    if (genericClassScope.mangledName !== '') {
        const genericMangledName = genericClassScope.mangledName;
        const reverse = genericMangledName.split('|').reverse();
        reverse[0] = name;
        newClassScope.mangledName = reverse.reverse().join('|');
        specializedClassType.mangledName = newClassScope.mangledName;
    }
    genericClassScope.children.forEach((s) => {
        const genericFuncScope = s as FunctionScope;
        const funcKind = genericFuncScope.funcType.funcKind;
        // constructor is not in the memberFuncs
        if (funcKind == FunctionKind.CONSTRUCTOR) {
            createMethodScope(
                specializedClassType.ctorType,
                newClassScope,
                context,
            );
        } else {
            let funcName = genericFuncScope.getName();
            // the function names of the getter and setter contain 'get_' and 'set_' prefix strings
            if (
                funcKind == FunctionKind.GETTER ||
                funcKind == FunctionKind.SETTER
            ) {
                funcName = funcName.substring(4);
            }
            const res = specializedClassType.memberFuncs.findIndex((f) => {
                return funcName === f.name && funcKind === f.type.funcKind;
            });
            if (res !== -1) {
                const specializedFunctionType =
                    specializedClassType.memberFuncs[res].type;
                createMethodScope(
                    specializedFunctionType,
                    newClassScope,
                    context,
                );
            }
        }
    });
    const genericBaseClassType = genericClassScope.classType.getBase();
    const specializedBaseClassType = specializedClassType.getBase();
    if (genericBaseClassType && specializedBaseClassType) {
        const genericBaseClassScope = genericBaseClassType.belongedScope;
        if (isTypeGeneric(genericBaseClassType) && genericBaseClassScope) {
            createScopeBySpecializedType(
                specializedBaseClassType,
                genericBaseClassScope.parent!,
                context,
            );
        }
    }
    return newClassScope;
}

/**
 * @describe create a new specialize method FunctionScope
 * @param specializedMethodType the new specialized method type
 * @param parentScope the parent class scope
 * @param context the parser context
 * @returns a new specialized method FunctionScope
 */
function createMethodScope(
    specializedMethodType: TSFunction,
    parentScope: ClassScope,
    context: ParserContext,
) {
    const classType = parentScope.classType;
    const typeArguments = classType.specializedArguments
        ? classType.specializedArguments
        : specializedMethodType.specializedArguments;

    if (
        !specializedMethodType.genericOwner ||
        (specializedMethodType.genericOwner &&
            !specializedMethodType.genericOwner.belongedScope) ||
        !typeArguments
    )
        return;

    const genericMethodType = specializedMethodType.genericOwner as TSFunction;
    const genericMethodScope =
        genericMethodType.belongedScope! as FunctionScope;
    const newMethodScope = new FunctionScope(parentScope);
    genericMethodScope.specialize(newMethodScope);
    newMethodScope.setClassName(classType.className);
    newMethodScope.setFuncName(genericMethodScope.getName());

    newMethodScope.setGenericOwner(genericMethodScope);
    genericMethodScope.addSpecializedScope(classType.className, newMethodScope);

    newMethodScope.setFuncType(specializedMethodType);
    specializedMethodType.setBelongedScope(newMethodScope);

    const typeParameters = genericMethodType.belongedClass!.typeArguments!;
    if (!typeArguments) return;

    // process funcName, mangledName and className of FunctionScope
    if (genericMethodScope.mangledName !== '') {
        const genericMangledName = genericMethodScope.mangledName;
        const reverse = genericMangledName.split('|').reverse();
        // class name
        reverse[1] = classType.className;
        newMethodScope.mangledName = reverse.reverse().join('|');
    }

    // process function parameters and create scope
    for (let idx = 0; idx < genericMethodType.getParamTypes().length; idx++) {
        const genericParamType = genericMethodType.getParamTypes()[idx];
        if (
            genericParamType instanceof TSTypeWithArguments &&
            genericParamType.belongedScope
        )
            createScopeBySpecializedType(
                specializedMethodType.getParamTypes()[
                    idx
                ] as TSTypeWithArguments,
                genericParamType.belongedScope.parent!,
                context,
            );
    }
    return newMethodScope;
}

/**
 * @describe create a new specialize FunctionScope
 * @param specializedFunctionType the new specialized function type
 * @param parentScope the parent scope
 * @param context the parser context
 * @returns a new specialized FunctionScope
 */
function createFunctionScope(
    specializedFunctionType: TSFunction,
    parentScope: Scope,
    context: ParserContext,
) {
    const typeArguments = specializedFunctionType.specializedArguments;
    if (
        !specializedFunctionType.genericOwner ||
        (specializedFunctionType.genericOwner &&
            !specializedFunctionType.genericOwner.belongedScope) ||
        !typeArguments
    )
        return;

    const genericFuncType = specializedFunctionType.genericOwner as TSFunction;
    const genericFunctionScope =
        genericFuncType.belongedScope! as FunctionScope;
    // check if a specialized scope already exists
    const typeArgumentsSignature: Array<string> = [];
    typeArguments.forEach((t) => {
        if (t.kind !== TypeKind.TYPE_PARAMETER) {
            typeArgumentsSignature.push(`${t.kind}`);
        } else {
            typeArgumentsSignature.push(`${(t as TSTypeParameter).name}`);
        }
    });
    const typeSignature =
        typeArgumentsSignature.length > 0
            ? '<' + typeArgumentsSignature.join(',') + '>'
            : '';
    const newFuncName = genericFunctionScope.getName() + typeSignature;
    if (
        genericFunctionScope.specializedScopes &&
        genericFunctionScope.specializedScopes.has(newFuncName)
    )
        return;

    const newFuncScope = new FunctionScope(parentScope);
    genericFunctionScope.specialize(newFuncScope);
    newFuncScope.setClassName('');
    newFuncScope.setFuncName(newFuncName);
    newFuncScope.setGenericOwner(genericFunctionScope);
    genericFunctionScope.addSpecializedScope(newFuncName, newFuncScope);
    newFuncScope.setFuncType(specializedFunctionType);
    specializedFunctionType.setBelongedScope(newFuncScope);

    const typeParameters = genericFuncType.typeArguments;
    if (!typeParameters) return;

    if (genericFunctionScope.mangledName !== '') {
        const genericMangledName = genericFunctionScope.mangledName;
        const reverse = genericMangledName.split('|').reverse();
        reverse[0] = newFuncName;
        newFuncScope.mangledName = reverse.reverse().join('|');
    }

    // Process function parameters and create scope
    for (let idx = 0; idx < genericFuncType.getParamTypes().length; idx++) {
        const genericParamType = genericFuncType.getParamTypes()[idx];
        if (
            genericParamType instanceof TSTypeWithArguments &&
            genericParamType.belongedScope
        )
            createScopeBySpecializedType(
                specializedFunctionType.getParamTypes()[
                    idx
                ] as TSTypeWithArguments,
                genericParamType.belongedScope.parent!,
                context,
            );
    }
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
        case TypeKind.ENUM:
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
            if (classType.typeArguments) {
                /* When the class type carries type parameters, its method member does not contain type parameter information.
                 * At this time, it is determined whether the function is a generic type by judging whether the class it belongs to is a generic type.
                 * e.g.
                 *  class A<T> {
                 *      a: T;
                 *      echo(param: T) {...};
                 *  }
                 */
                return true;
            } else {
                /**
                 *  class A {
                 *      a: number;
                 *      echo<T>(param: T) {...};
                 *  }
                 *  const a = new A();
                 *  this class type does not contain 'typeParameters', and newExpression does not contain 'typeArguments'.
                 */
                return classType.memberFuncs.some((func) => {
                    return isTypeGeneric(func.type);
                });
            }
        }
        case TypeKind.TYPE_PARAMETER: {
            return true;
        }
        default: {
            throw new UnimplementError(`Not implemented type: ${type.kind}`);
        }
    }
}

/**
 * @describe calculate 'typeArguments' from the formal parameters and actual parameters
 * @param formalParameters the formal parameters of this generic function
 * @param typeParameters the typeParameter list of this generic function
 * @param actualParameters the actual parameters of this generic function
 * @returns typeArguments
 */
// Currently only some basic types can be processed
export function getTypeArgumentsFromParameters(
    formalParameters: Type[],
    typeParameters: TSTypeParameter[],
    actualParameters: Type[],
) {
    if (
        formalParameters.length == 0 ||
        typeParameters.length == 0 ||
        actualParameters.length == 0
    )
        return [];

    if (formalParameters.length > actualParameters.length) {
        formalParameters = formalParameters.slice(0, actualParameters.length);
    }
    const typeArguments = new Array(typeParameters.length);
    // argument type
    const argTypes = actualParameters;
    // TODO: Handling optional parameters
    for (let i = 0; i < formalParameters.length; i++) {
        const pType = formalParameters[i];
        if (!isTypeGeneric(pType)) continue;

        const aType = argTypes[i];
        if (pType instanceof TSTypeParameter) {
            const index = typeParameters.findIndex((t) => {
                return t.name === pType.name;
            });
            if (index == -1) {
                throw new UnimplementError(
                    `${pType.name} not found in typeParameters`,
                );
            }
            typeArguments[index] = aType;
        } else if (pType instanceof TSTypeWithArguments) {
            const genericTypeList = pType.typeArguments!;
            const specializedTypeList = (aType as TSTypeWithArguments)
                .specializedArguments;
            if (specializedTypeList) {
                let idx = 0;
                genericTypeList.forEach((g) => {
                    const index = typeParameters.findIndex((t) => {
                        return t.name === g.name;
                    });
                    if (index == -1) {
                        throw new UnimplementError(
                            `${g.name} not found in typeParameters`,
                        );
                    }
                    typeArguments[index] = specializedTypeList[idx];
                    idx++;
                });
            }
        } else if (pType instanceof TSArray) {
            // workaround
            const genericElemType = pType.elementType;
            if (aType.kind !== TypeKind.ARRAY) {
                typeArguments[i] = aType;
            } else {
                if (genericElemType instanceof TSTypeParameter) {
                    const specializedElemType = (aType as TSArray).elementType;
                    const index = typeParameters.findIndex((t) => {
                        return t.name === genericElemType.name;
                    });
                    if (index == -1) {
                        throw new UnimplementError(
                            `${genericElemType.name} not found in typeParameters`,
                        );
                    }
                    typeArguments[index] = specializedElemType;
                } else {
                    throw new UnimplementError(
                        `generic Array specialization operation for complex elementType is not implemented`,
                    );
                }
            }
        } else if (pType instanceof TSUnion) {
            const types = pType.types;
            let i = 0;
            types.forEach((t) => {
                if (t.kind == TypeKind.TYPE_PARAMETER) return;
                i++;
            });
            const index = typeParameters.findIndex((t) => {
                return t.name === (types[i] as TSTypeParameter).name;
            });
            if (index == -1) {
                throw new UnimplementError(
                    `${
                        (types[i] as TSTypeParameter).name
                    } not found in typeParameters`,
                );
            }
            typeArguments[index] = aType;
        }
    }
    return typeArguments;
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
    ARRAYBUFFER,
    ARRAYBUFFER_CONSTRUCTOR,
    DATAVIEW,
    DATAVIEW_CONSTRUCTOR,
    WASM_I64,
    WASM_F32,
    BUILTIN_TYPE_BEGIN,

    CUSTOM_TYPE_BEGIN = BUILTIN_TYPE_BEGIN + 1000,
}
export const DefaultTypeId = -1;
export const CustomTypeId = PredefinedTypeId.CUSTOM_TYPE_BEGIN;

export function getBuiltinType(typeStr: string): Type | undefined {
    if (builtinTypes.has(typeStr)) {
        return builtinTypes.get(typeStr);
    } else if (builtinWasmTypes.has(typeStr)) {
        return builtinWasmTypes.get(typeStr);
    } else {
        return undefined;
    }
}

export function isImportComment(obj: any): obj is Import {
    return obj && 'moduleName' in obj;
}

export function isNativeSignatureComment(obj: any): obj is NativeSignature {
    return obj && 'paramTypes' in obj;
}

export function isExportComment(obj: any): obj is Export {
    return obj && 'exportName' in obj;
}

export function parseComment(commentStr: string) {
    commentStr = commentStr.replace(/\s/g, '');
    if (!commentStr.includes('Wasmnizer-ts')) {
        return null;
    }
    const commentKindReg = commentStr.match(/@([^@]+)@/);
    if (!commentKindReg) {
        return null;
    }
    const commentKind = commentKindReg[1];
    switch (commentKind) {
        case CommentKind.NativeSignature: {
            const signatureStrReg = commentStr.match(/@([^@]+)$/);
            if (!signatureStrReg) {
                Logger.error('invalid signature in NativeSignature comment');
                return null;
            }
            const signatureStr = signatureStrReg[1];
            const signatureReg = signatureStr.match(/\(([^)]*)\)\s*=>\s*(\w+)/);
            if (!signatureReg) {
                Logger.error('invalid signature in NativeSignature comment');
                return null;
            }
            const parameterTypesArr = signatureReg[1].split(/\s*,\s*/);
            const returnTypeStr = signatureReg[2];
            const paramTypes: Type[] = [];
            for (const paramStr of parameterTypesArr) {
                const builtinType = getBuiltinType(paramStr);
                if (!builtinType) {
                    Logger.error(
                        'unsupported signature type in NativeSignature comment',
                    );
                    return null;
                }
                paramTypes.push(builtinType);
            }
            const builtinType = getBuiltinType(returnTypeStr);
            if (!builtinType) {
                Logger.error(
                    'unsupported signature type in NativeSignature comment',
                );
                return null;
            }
            const returnType = builtinType;
            const obj: NativeSignature = {
                paramTypes: paramTypes,
                returnType: returnType,
            };
            return obj;
        }
        case CommentKind.Import: {
            const importInfoReg = commentStr.match(
                /@Import@([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+$)/,
            );
            if (!importInfoReg) {
                Logger.error('invalid information in Import comment');
                return null;
            }
            const moduleName = importInfoReg[1];
            const funcName = importInfoReg[2];
            const obj: Import = {
                moduleName: moduleName,
                funcName: funcName,
            };
            return obj;
        }
        case CommentKind.Export: {
            const exportInfoReg = commentStr.match(/@Export@([a-zA-Z0-9_$]+$)/);
            if (!exportInfoReg) {
                Logger.error('invalid information in Export comment');
                return null;
            }
            const exportName = exportInfoReg[1];
            const obj: Export = {
                exportName: exportName,
            };
            return obj;
        }
        default: {
            Logger.error(`unsupported comment kind ${commentKind}`);
            return null;
        }
    }
}

export function parseCommentBasedNode(
    node: ts.FunctionLikeDeclaration,
    functionScope: FunctionScope,
) {
    const commentRanges = ts.getLeadingCommentRanges(
        node.getSourceFile().getFullText(),
        node.getFullStart(),
    );
    if (commentRanges?.length) {
        const commentStrings: string[] = commentRanges.map((r) =>
            node.getSourceFile().getFullText().slice(r.pos, r.end),
        );
        for (const commentStr of commentStrings) {
            const parseRes = parseComment(commentStr);
            if (parseRes) {
                const idx = functionScope.comments.findIndex((item) => {
                    return (
                        (isExportComment(item) && isExportComment(parseRes)) ||
                        (isImportComment(item) && isImportComment(parseRes)) ||
                        (isNativeSignatureComment(item) &&
                            isNativeSignatureComment(parseRes))
                    );
                });
                if (idx !== -1) {
                    functionScope.comments[idx] = parseRes;
                } else {
                    functionScope.comments.push(parseRes);
                }
            }
        }
    }
}

export function convertWindowsPath(path: string) {
    if (process?.platform === 'win32') {
        // handle the edge-case of Window's long file names
        // See: https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#short-vs-long-names
        path = path.replace(/^\\\\\?\\/, '');

        // convert the separators, valid since both \ and / can't be in a windows filename
        path = path.replace(/\\/g, '/');

        // compress any // or /// to be just /, which is a safe oper under POSIX
        // and prevents accidental errors caused by manually doing path1+path2
        path = path.replace(/\/\/+/g, '/');
    }

    return path;
}
