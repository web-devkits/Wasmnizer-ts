/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import path from 'path';

import { ParserContext } from './frontend.js';
import {
    generateNodeExpression,
    getExportIdentifierName,
    getGlobalScopeByModuleName,
    getImportIdentifierName,
    getModulePath,
} from './utils.js';
import { GlobalScope, Scope } from './scope.js';
import { Expression, IdentifierExpression } from './expression.js';

export class ImportResolver {
    globalScopes: Array<GlobalScope>;
    currentScope: Scope | null = null;
    nodeScopeMap: Map<ts.Node, Scope>;

    constructor(private parserCtx: ParserContext) {
        this.globalScopes = this.parserCtx.globalScopes;
        this.nodeScopeMap = this.parserCtx.nodeScopeMap;
    }

    visit() {
        /* Handle import and export nodes */
        this.nodeScopeMap.forEach((scope, node) => {
            ts.forEachChild(node, this.visitNode.bind(this));
        });
        /* Auto import the standard library module for every user file */
        const builtinScopes = this.globalScopes.filter((scope) => {
            return !!this.parserCtx.builtinFileNames.find((name) => {
                const fileName = path.basename(scope.moduleName);
                return name.includes(fileName);
            });
        });

        for (let i = 0; i < this.globalScopes.length; i++) {
            const scope = this.globalScopes[i];
            if (builtinScopes.indexOf(scope) < 0) {
                for (const builtinScope of builtinScopes) {
                    for (const builtinIdentifier of builtinScope.declareIdentifierList) {
                        scope.addImportIdentifier(
                            builtinIdentifier,
                            builtinScope,
                        );
                    }
                }
            }
        }
    }

    visitNode(node: ts.Node): void {
        this.currentScope = this.parserCtx.getScopeByNode(node)!;
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration: {
                const importDeclaration = <ts.ImportDeclaration>node;
                const globalScope = this.currentScope!.getRootGloablScope()!;
                // Get the import module name according to the relative position of current scope
                const importModuleName = getModulePath(
                    importDeclaration,
                    this.currentScope!.getRootGloablScope()!,
                );
                const importModuleScope = getGlobalScopeByModuleName(
                    importModuleName!,
                    this.globalScopes,
                );
                // get import identifier
                const {
                    importIdentifierArray,
                    nameScopeImportName,
                    nameAliasImportMap,
                    defaultImportName,
                } = getImportIdentifierName(importDeclaration);
                for (const importIdentifier of importIdentifierArray) {
                    globalScope.addImportIdentifier(
                        importIdentifier,
                        importModuleScope,
                    );
                }
                globalScope.setImportNameAlias(nameAliasImportMap);
                if (nameScopeImportName) {
                    globalScope.addImportNameScope(
                        nameScopeImportName,
                        importModuleScope,
                    );
                }
                if (defaultImportName) {
                    globalScope.addImportDefaultName(
                        defaultImportName,
                        importModuleScope,
                    );
                }
                break;
            }
            case ts.SyntaxKind.ExportDeclaration: {
                const exportDeclaration = <ts.ExportDeclaration>node;
                const globalScope = this.currentScope!.getRootGloablScope()!;
                const exportModuleName = getModulePath(
                    exportDeclaration,
                    this.currentScope!.getRootGloablScope()!,
                );
                let importModuleScope: GlobalScope | undefined = undefined;
                if (exportModuleName) {
                    importModuleScope = getGlobalScopeByModuleName(
                        exportModuleName,
                        this.globalScopes,
                    );
                }
                const { nameAliasExportMap, exportIdentifierList } =
                    getExportIdentifierName(
                        exportDeclaration,
                        globalScope,
                        importModuleScope!,
                    );
                globalScope.setExportNameAlias(nameAliasExportMap);
                globalScope.setExportIdentifierList(exportIdentifierList);

                if (importModuleScope) {
                    const {
                        importIdentifierArray,
                        nameScopeImportName,
                        nameAliasImportMap,
                    } = getImportIdentifierName(exportDeclaration);

                    for (const importIdentifier of importIdentifierArray) {
                        globalScope.addImportIdentifier(
                            importIdentifier,
                            importModuleScope,
                        );
                    }
                    globalScope.setImportNameAlias(nameAliasImportMap);
                    if (nameScopeImportName) {
                        globalScope.addImportNameScope(
                            nameScopeImportName,
                            importModuleScope,
                        );
                    }
                }
                break;
            }
            case ts.SyntaxKind.ExportAssignment: {
                const exportAssign = <ts.ExportAssignment>node;
                const globalScope = this.currentScope!.getRootGloablScope()!;
                let exportExpr: Expression;
                if (ts.isIdentifier(exportAssign.expression)) {
                    exportExpr = new IdentifierExpression(
                        exportAssign.expression.getText(),
                    );
                } else {
                    exportExpr = generateNodeExpression(
                        this.parserCtx.expressionProcessor,
                        exportAssign.expression,
                    );
                }
                globalScope.defaultExpr = exportExpr;
                globalScope.exportIdentifierList.push(exportExpr);
                break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ClassDeclaration: {
                const curNode = <ts.ClassDeclaration | ts.FunctionDeclaration>(
                    node
                );
                if (ts.getModifiers(curNode)) {
                    for (const modifier of ts.getModifiers(curNode)!) {
                        if (modifier.kind === ts.SyntaxKind.DefaultKeyword) {
                            const globalScope =
                                this.currentScope!.getRootGloablScope()!;
                            const defaultName = curNode.name!.getText()!;
                            globalScope.defaultExpr = new IdentifierExpression(
                                defaultName,
                            );
                            break;
                        }
                    }
                }
                break;
            }
            default: {
                ts.forEachChild(node, this.visitNode.bind(this));
            }
        }
    }
}
