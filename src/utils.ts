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
    WasmArrayType,
    WasmStructType,
    TSTuple,
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
    WASMArray = 'WASMArray',
    WASMStruct = 'WASMStruct',
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

export enum PackedTypeKind {
    Not_Packed = 'Not_Packed',
    I8 = 'I8',
    I16 = 'I16',
}

export enum MutabilityKind {
    Immutable = 'Immutable',
    Mutable = 'Mutable',
}

export enum NullabilityKind {
    NonNullable = 'NonNullable',
    Nullable = 'Nullable',
}

export interface WASMArray {
    WASMArray: boolean;
    packedType: PackedTypeKind;
    mutability: MutabilityKind;
    nullability: NullabilityKind;
}

export interface WASMStruct {
    WASMStruct: boolean;
    packedTypes?: PackedTypeKind[];
    mutabilitys?: MutabilityKind[];
    nullability?: NullabilityKind;
    baseTypeName?: string;
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

export function genericFunctionProcessor(
    genericFuncType: TSFunction,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
    isMethod = false,
    doSpecialization = false,
): TSFunction {
    if (
        typeArguments.length == 0 ||
        typeParameters.length == 0 ||
        (!isMethod && !genericFuncType.typeArguments)
    ) {
        return genericFuncType;
    }

    const genericOwner = genericFuncType.genericOwner
        ? genericFuncType.genericOwner
        : genericFuncType;

    let typeSignature = '';
    if (doSpecialization && !isMethod) {
        const _typeParameters = genericFuncType.typeArguments!;
        typeSignature = getTypeSignature(
            _typeParameters,
            typeParameters,
            typeArguments,
        );
        const found = TypeResolver.findTypeInSpecialiezedTypeCache(
            genericFuncType,
            typeSignature,
        );
        if (found) return found as TSFunction;
    }

    const newFuncType = genericFuncType.clone();
    newFuncType.setGenericOwner(genericOwner);
    newFuncType.setBelongedScope(undefined);

    if (doSpecialization) {
        if (!isMethod || (isMethod && genericFuncType.typeArguments)) {
            newFuncType.setSpecializedArguments(typeArguments);
        }
        // specialized function does not have typeArguments
        newFuncType.setTypeParameters(undefined);

        // iff method
        if (newFuncType.belongedClass) {
            newFuncType.belongedClass = undefined;
        }
    } else {
        // regenerate typeParameters
        if (!isMethod) {
            newFuncType.setSpecializedArguments(typeArguments);
            newFuncType.setTypeParameters([]);
            genericFuncType.typeArguments!.forEach((t) => {
                newFuncType.addTypeParameter(
                    genericCoreProcessor(
                        t,
                        typeArguments,
                        typeParameters,
                        context,
                    ) as TSTypeParameter,
                );
            });
        }
    }

    // regenerate the parameters
    newFuncType.setParamTypes([]);
    genericFuncType.getParamTypes().forEach((paramType) => {
        const newParamType = genericCoreProcessor(
            paramType,
            typeArguments,
            typeParameters,
            context,
            true,
        );
        newFuncType.addParamType(newParamType);
    });

    // prevent infinite recursive call
    if (
        isMethod &&
        (genericFuncType.funcKind == FunctionKind.CONSTRUCTOR ||
            (genericFuncType.returnType instanceof TSClass &&
                genericFuncType.returnType.toString ===
                    genericFuncType.belongedClass!.toString))
    )
        return newFuncType;

    // update specializedTypeCache
    if (doSpecialization && !isMethod) {
        TypeResolver.updateSpecializedTypeCache(
            genericOwner,
            typeSignature,
            newFuncType,
        );
    }

    newFuncType.returnType = genericCoreProcessor(
        genericFuncType.returnType,
        typeArguments,
        typeParameters,
        context,
        true,
    );
    return newFuncType;
}

export function genericClassProcessor(
    genericClassType: TSClass,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
    doSpecialization = false,
    namePrefix?: string,
): TSClass {
    if (
        typeArguments.length == 0 ||
        typeParameters.length == 0 ||
        (!doSpecialization && !genericClassType.typeArguments)
    )
        return genericClassType;

    let typeSignature = '';
    if (doSpecialization) {
        const _typeParameters = genericClassType.typeArguments;
        if (_typeParameters) {
            typeSignature = getTypeSignature(
                _typeParameters,
                typeParameters,
                typeArguments,
            );
        }
        const found = TypeResolver.findTypeInSpecialiezedTypeCache(
            genericClassType,
            typeSignature,
        );
        if (found) return found as TSClass;
    }

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

        const newClassName = doSpecialization
            ? genericClassType.className + typeSignature
            : namePrefix
            ? namePrefix + '_' + genericClassType.className
            : genericClassType.className;
        newClassType.setClassName(newClassName);

        const genericOwner = genericClassType.genericOwner
            ? genericClassType.genericOwner
            : genericClassType;
        newClassType.setGenericOwner(genericOwner as TSClass);

        newClassType.setSpecializedArguments(typeArguments);

        if (doSpecialization) {
            if (genericClassType.mangledName !== '') {
                const genericMangledName = genericClassType.mangledName;
                newClassType.mangledName =
                    genericMangledName.substring(
                        0,
                        genericMangledName.lastIndexOf('|') + 1,
                    ) + newClassName;
            }

            // update specializedTypeCache
            TypeResolver.updateSpecializedTypeCache(
                genericOwner,
                newClassName,
                newClassType,
            );
        } else {
            // regenerate typeParameters
            newClassType.setTypeParameters([]);
            genericClassType.typeArguments!.forEach((t) => {
                newClassType.addTypeParameter(
                    genericCoreProcessor(
                        t,
                        typeArguments,
                        typeParameters,
                        context,
                    ) as TSTypeParameter,
                );
            });
        }

        // base class type
        if (genericClassType.getBase()) {
            let baseType = genericClassType.getBase();
            if (baseType) {
                if (isTypeGeneric(baseType)) {
                    baseType = genericClassProcessor(
                        baseType,
                        typeArguments,
                        typeParameters,
                        context,
                        doSpecialization,
                        namePrefix,
                    ) as TSClass;
                }
                newClassType.setBase(baseType);
            }
        }

        const implInfc = genericClassType.getImplInfc();
        if (implInfc && isTypeGeneric(implInfc)) {
            const newInfcType = genericCoreProcessor(
                implInfc,
                typeArguments,
                typeParameters,
                context,
                doSpecialization,
                namePrefix,
            ) as TSInterface;
            newClassType.setImplInfc(newInfcType);
        } else {
            newClassType.setImplInfc(implInfc);
        }

        genericClassType.fields.forEach((field) => {
            const newFieldType = genericCoreProcessor(
                field.type,
                typeArguments,
                typeParameters,
                context,
                doSpecialization,
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
                const newFuncType = genericFunctionProcessor(
                    func.type,
                    typeArguments,
                    typeParameters,
                    context,
                    true,
                    doSpecialization,
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
            const newStaticFieldType = genericCoreProcessor(
                field.type,
                typeArguments,
                typeParameters,
                context,
                doSpecialization,
            );
            if (newStaticFieldType instanceof TSTypeWithArguments)
                newClassType.addStaticMemberField({
                    name: field.name,
                    type: newStaticFieldType,
                });
        });
        if (genericClassType.ctorType) {
            const newCtor = genericFunctionProcessor(
                genericClassType.ctorType,
                typeArguments,
                typeParameters,
                context,
                true,
                doSpecialization,
            ) as TSFunction;
            newCtor.belongedClass = newClassType;
            newClassType.ctorType = newCtor;
            newClassType.ctorType.returnType = newClassType;
        }

        if (genericClassType.belongedScope)
            if (doSpecialization) {
                genericClassType.belongedScope.parent?.addType(
                    newClassType.className,
                    newClassType,
                );
            } else {
                const typeNames = new Array<string>();
                typeArguments.forEach((v) => {
                    typeNames.push(`${(v as TSTypeParameter).name}`);
                });
                const typeSignature = '<' + typeNames.join(',') + '>';
                genericClassType.belongedScope.parent?.addType(
                    newClassType.className + typeSignature,
                    newClassType,
                );
            }
        return newClassType;
    } else {
        if (doSpecialization) {
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
                    const genericFunctionScopeName =
                        genericFunctionScope.getName();
                    const specializedFunctionScopeName =
                        genericFunctionScopeName + typeSignature;
                    // whether the specialized generic method already exists
                    const existMethod = genericClassType.getMethod(
                        specializedFunctionScopeName,
                    );
                    if (existMethod.method) return genericClassType;

                    methodSpecialize(genericFuncType, typeArguments, context);
                }
            });
        }
        return genericClassType;
    }
}

/**
 *  class A {
 *      a: number;
 *      echo<T>(param: T) {...};
 *  }
 *  const a = new A();
 *  this class type does not contain 'typeParameters'.
 */
export function methodSpecialize(
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
        if (v instanceof TSClass) {
            typeNames.push(v.className);
        } else {
            typeNames.push(`${v.kind}`);
        }
    });
    const typeSignature = '<' + typeNames.join(',') + '>';
    const newFuncName = originalFunctionScope.getName() + typeSignature;
    const specializedFunctionType = genericFunctionProcessor(
        genericMethodType,
        typeArguments,
        typeParameters,
        context,
        true,
        true,
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
                methodSpecialize(m.type, typeArguments, context);
            });
        }
    });
}

/**
 * @describe specialize a generic type OR update the generic typeParameters
 * @param genericType the generic type that need to be updated or specialized
 * @param typeArguments type arguments
 * @param typeParameters generic parameter types
 * @param context the parser context
 * @param doSpecialization specialize the generic type when it is true; update the generic typeParameters when it is false
 * @param namePrefix in the generic inheritance chain, we will generate a new base class, and the new base class will be renamed
 * @returns a new generic type
 */
export function genericCoreProcessor(
    genericType: Type,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
    doSpecialization = false,
    namePrefix?: string,
): Type {
    // the type being processed must be generic type
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
                genericCoreProcessor(
                    (genericType as TSArray).elementType,
                    typeArguments,
                    typeParameters,
                    context,
                    doSpecialization,
                    namePrefix,
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
                    const newType = genericCoreProcessor(
                        t,
                        typeArguments,
                        typeParameters,
                        context,
                        doSpecialization,
                        namePrefix,
                    );
                    newUnion.addType(newType);
                }
            });
            return newUnion;
        }
        case TypeKind.FUNCTION: {
            const newFuncType = genericFunctionProcessor(
                genericType as TSFunction,
                typeArguments,
                typeParameters,
                context,
                false,
                doSpecialization,
            );

            return newFuncType;
        }
        case TypeKind.CLASS:
        case TypeKind.INTERFACE: {
            const newClassType = genericClassProcessor(
                genericType as TSClass,
                typeArguments,
                typeParameters,
                context,
                doSpecialization,
                namePrefix,
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

/**
 * @describe specialize a generic type, or update the parameter type list of this generic type
 * @param genericType the generic type that need to be processed
 * @param typeArguments specialized type arguments list
 * @param typeParameters generic parameter type list
 * @param context the parser context
 * @param namePrefix in the generic inheritance chain, we will generate a new base class, and the new base class will be renamed.
 * e.g.
 *  class A<T> {...};
 *  class B<X, Y> extends A<Y> {...}
 *
 * In this case, we need to generate a new generic type B_A<Y>, so that its specialization operation will not affect its original type A<T>.
 * At this time, the namePrefix is 'B_'.
 * @returns a new type
 */
export function processGenericType(
    genericType: Type,
    typeArguments: Type[],
    typeParameters: TSTypeParameter[],
    context: ParserContext,
    namePrefix?: string,
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
            newType = genericCoreProcessor(
                genericType,
                typeArguments,
                typeParameters,
                context,
                false,
                namePrefix,
            );
    } else {
        if (genericType instanceof TSTypeWithArguments) {
            let typeSignature = '';
            const _typeParameters = genericType.typeArguments;
            if (_typeParameters) {
                typeSignature = getTypeSignature(
                    _typeParameters,
                    typeParameters,
                    typeArguments,
                );
            }
            const found = TypeResolver.findTypeInSpecialiezedTypeCache(
                genericType,
                typeSignature,
            );
            if (found) return found;
        }
        newType = genericCoreProcessor(
            genericType,
            typeArguments,
            typeParameters,
            context,
            true,
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
                false,
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
            createFunctionScope(
                specializedClassType.ctorType,
                newClassScope,
                true,
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
                createFunctionScope(
                    specializedFunctionType,
                    newClassScope,
                    true,
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
 * @describe create a new specialize FunctionScope
 * @param specializedFunctionType the new specialized function type
 * @param parentScope the parent scope
 * @param isMethod method or not
 * @param context the parser context
 * @returns a new specialized FunctionScope
 */
function createFunctionScope(
    specializedFunctionType: TSFunction,
    parentScope: Scope,
    isMethod: boolean,
    context: ParserContext,
) {
    const typeArguments = isMethod
        ? (parentScope as ClassScope).classType.specializedArguments
            ? (parentScope as ClassScope).classType.specializedArguments
            : specializedFunctionType.specializedArguments
        : specializedFunctionType.specializedArguments;
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

    let typeSignature = '';
    // check if a specialized scope already exists
    if (!isMethod) {
        const typeArgumentsSignature: Array<string> = [];
        typeArguments.forEach((t) => {
            if (t.kind !== TypeKind.TYPE_PARAMETER) {
                if (t instanceof TSClass) {
                    typeArgumentsSignature.push(t.className);
                } else {
                    typeArgumentsSignature.push(`${t.kind}`);
                }
            } else {
                typeArgumentsSignature.push(`${(t as TSTypeParameter).name}`);
            }
        });
        typeSignature =
            typeArgumentsSignature.length > 0
                ? '<' + typeArgumentsSignature.join(',') + '>'
                : '';
        if (
            genericFunctionScope.specializedScopes &&
            genericFunctionScope.specializedScopes.has(
                genericFunctionScope.getName() + typeSignature,
            )
        )
            return;
    }

    const newFuncScope = new FunctionScope(parentScope);
    newFuncScope.setGenericOwner(genericFunctionScope);
    genericFunctionScope.specialize(newFuncScope);

    if (isMethod) {
        newFuncScope.setClassName((parentScope as ClassScope).className);
        newFuncScope.setFuncName(genericFunctionScope.getName());
        genericFunctionScope.addSpecializedScope(
            (parentScope as ClassScope).className,
            newFuncScope,
        );
    } else {
        newFuncScope.setFuncName(
            genericFunctionScope.getName() + typeSignature,
        );
        genericFunctionScope.addSpecializedScope(
            genericFunctionScope.getName() + typeSignature,
            newFuncScope,
        );
    }

    newFuncScope.setFuncType(specializedFunctionType);
    specializedFunctionType.setBelongedScope(newFuncScope);

    const typeParameters = isMethod
        ? genericFuncType.belongedClass!.typeArguments
        : genericFuncType.typeArguments;
    if (!typeParameters) return;

    // process funcName, mangledName and className of FunctionScope
    if (genericFunctionScope.mangledName !== '') {
        const genericMangledName = genericFunctionScope.mangledName;
        const reverse = genericMangledName.split('|').reverse();
        if (isMethod) {
            // class name
            reverse[1] = (parentScope as ClassScope).className;
        } else {
            reverse[0] = genericFunctionScope.getName() + typeSignature;
        }
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
        case TypeKind.TUPLE: {
            const tuple = type as TSTuple;
            const typeArr = tuple.elements;
            return typeArr.some((type) => {
                return isTypeGeneric(type);
            });
        }
        case TypeKind.ARRAY: {
            return isTypeGeneric((type as TSArray).elementType);
        }
        case TypeKind.WASM_ARRAY: {
            const arr = (type as WasmArrayType).arrayType;
            return isTypeGeneric(arr.elementType);
        }
        case TypeKind.WASM_STRUCT: {
            const tuple = (type as WasmStructType).tupleType;
            return isTypeGeneric(tuple);
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
export function calculateTypeArguments(
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

/**
 * @describe generate signature from 'typeParameters' and 'typeArguments'
 * @param parameters     the actual type parameters, for example:         [Y]
 * @param typeParameters the type parameters collection, for example:     [X, Y, Z]
 * @param typeArguments  the type arguments collection, for example:      [number, string, boolean]
 * @returns type signature, for example:                                  '<string>'
 */
export function getTypeSignature(
    parameters: TSTypeParameter[],
    typeParameters: TSTypeParameter[],
    typeArguments: Type[],
) {
    const typeNames: Array<string> = [];
    parameters.forEach((type) => {
        const index = typeParameters.findIndex((t) => {
            return t.name === type.name;
        });
        if (index == -1) {
            throw new UnimplementError(
                `${type.name} not found in typeParameters`,
            );
        }
        if (typeArguments[index] instanceof TSClass) {
            typeNames.push((typeArguments[index] as TSClass).className);
        } else {
            typeNames.push(`${typeArguments[index].kind}`);
        }
    });
    const typeSignature =
        typeNames.length > 0 ? '<' + typeNames.join(',') + '>' : '';
    return typeSignature;
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
    WASM_ARRAY,
    WASM_STRUCT,
    TUPLE,
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

export function isWASMArrayComment(obj: any): obj is WASMArray {
    return obj && 'WASMArray' in obj;
}

export function isWASMStructComment(obj: any): obj is WASMStruct {
    return obj && 'WASMStruct' in obj;
}

export function isPackedTypeKind(packedType: string) {
    return Object.values(PackedTypeKind).includes(packedType as PackedTypeKind);
}

export function isMutabilityKind(mutability: string) {
    return Object.values(MutabilityKind).includes(mutability as MutabilityKind);
}

export function isNullabilityKind(nullability: string) {
    return Object.values(NullabilityKind).includes(
        nullability as NullabilityKind,
    );
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
        case CommentKind.WASMArray: {
            const basicArrayInfoReg = commentStr.match(/@WASMArray@\s*/);
            if (basicArrayInfoReg === null) {
                Logger.error('invalid information in WASMArray comment');
                return null;
            }
            let packedTypeKind = PackedTypeKind.Not_Packed;
            let mutabilityKind = MutabilityKind.Mutable;
            let nullabilityKind = NullabilityKind.Nullable;
            const arrayInfoReg = commentStr.match(
                /@WASMArray@<\s*([^,]+),\s*([^,]+),\s*([^>]+)>/,
            );
            if (arrayInfoReg && arrayInfoReg.length === 4) {
                Logger.info('use total message of WASMArray comment');
                if (
                    !(
                        isPackedTypeKind(arrayInfoReg[1]) &&
                        isMutabilityKind(arrayInfoReg[2]) &&
                        isNullabilityKind(arrayInfoReg[3])
                    )
                ) {
                    Logger.error('typo error in WASMArray comment');
                    return null;
                }
                packedTypeKind = arrayInfoReg[1] as PackedTypeKind;
                mutabilityKind = arrayInfoReg[2] as MutabilityKind;
                nullabilityKind = arrayInfoReg[3] as NullabilityKind;
            }
            const obj: WASMArray = {
                WASMArray: true,
                packedType: packedTypeKind,
                mutability: mutabilityKind,
                nullability: nullabilityKind,
            };
            return obj;
        }
        case CommentKind.WASMStruct: {
            const basicStructInfoReg = commentStr.match(/@WASMStruct@\s*/);
            if (basicStructInfoReg === null) {
                Logger.error('invalid information in WASMStruct comment');
                return null;
            }
            let obj: WASMStruct = { WASMStruct: true };
            const structInfoReg = commentStr.match(
                /@WASMStruct@<\s*\[([^>]+)\],\s*\[([^>]+)\],\s*([^,]+),\s*([^>]+)>/,
            );
            if (structInfoReg && structInfoReg.length === 5) {
                Logger.info('use total message of WASMStruct comment');
                const nullabilityKind = structInfoReg[3];
                if (
                    !(
                        structInfoReg[1]
                            .split(',')
                            .every((item) => isPackedTypeKind(item)) &&
                        structInfoReg[2]
                            .split(',')
                            .every((item) => isMutabilityKind(item)) &&
                        isNullabilityKind(nullabilityKind)
                    )
                ) {
                    Logger.error('typo error in WASMStruct comment');
                    return null;
                }
                const packedTypeKindArray = structInfoReg[1]
                    .split(',')
                    .map((item) => item.trim());
                const mutabilityKindArray = structInfoReg[2]
                    .split(',')
                    .map((item) => item.trim());
                obj = {
                    WASMStruct: true,
                    packedTypes: packedTypeKindArray as PackedTypeKind[],
                    mutabilitys: mutabilityKindArray as MutabilityKind[],
                    nullability: nullabilityKind as NullabilityKind,
                    baseTypeName: structInfoReg[4],
                };
            }
            return obj;
        }
        default: {
            Logger.error(`unsupported comment kind ${commentKind}`);
            return null;
        }
    }
}

export function parseCommentBasedNode(node: ts.Node) {
    const commentRanges = ts.getLeadingCommentRanges(
        node.getSourceFile().getFullText(),
        node.getFullStart(),
    );
    let commentStrings: string[] = [];
    if (commentRanges?.length) {
        commentStrings = commentRanges.map((r) =>
            node.getSourceFile().getFullText().slice(r.pos, r.end),
        );
    }
    return commentStrings;
}

export function parseCommentBasedTypeAliasNode(node: ts.TypeAliasDeclaration) {
    const commentStrings = parseCommentBasedNode(node);
    if (commentStrings.length > 0) {
        /* only the last comment is the valid comment */
        const validComment = commentStrings[commentStrings.length - 1];
        const parseRes = parseComment(validComment);
        if (parseRes) {
            return parseRes;
        }
    }
    return null;
}

export function parseCommentBasedFuncNode(
    node: ts.FunctionLikeDeclaration,
    functionScope: FunctionScope,
) {
    const commentStrings = parseCommentBasedNode(node);
    if (commentStrings.length > 0) {
        for (const commentStr of commentStrings) {
            const parseRes = parseComment(commentStr);
            if (
                parseRes &&
                (isExportComment(parseRes) ||
                    isImportComment(parseRes) ||
                    isNativeSignatureComment(parseRes))
            ) {
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
