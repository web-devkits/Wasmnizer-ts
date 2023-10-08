/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import {
    SemanticsNode,
    ModuleNode,
    VarDeclareNode,
    VarStorageType,
    BasicBlockNode,
    BlockNode,
    FunctionDeclareNode,
    FunctionOwnKind,
    ParameterNodeFlag,
    ExternModule,
    ExternType,
    ExternTypeKind,
} from './semantics_nodes.js';
import { Logger } from '../log.js';
import { ParserContext } from '../frontend.js';
import { TSClass, TSInterface, TypeResolver } from '../type.js';
import { Parameter } from '../variable.js';
import {
    ValueType,
    ValueTypeKind,
    Primitive,
    FunctionType,
    ObjectType,
    EnumType,
} from './value_types.js';
import { PredefinedTypeId } from '../utils.js';
import { GetPredefinedType } from './predefined_types.js';
import { flattenFunction } from './flatten.js';
import { BuildContext, SymbolKey, SymbolValue } from './builder_context.js';
import { SemanticsValueKind, SemanticsValue, VarValue } from './value.js';
import {
    Scope,
    ScopeKind,
    GlobalScope,
    FunctionScope,
    ClassScope,
    BlockScope,
    NamespaceScope,
    ClosureEnvironment,
} from '../scope.js';
import { buildExpression, shapeAssignCheck } from './expression_builder.js';
import { createType, createObjectDescriptionShapes } from './type_creator.js';
import {
    createFromVariable,
    buildStatement,
    createLocalSymbols,
} from './statement_builder.js';
import { CreateDefaultDumpWriter } from './dump.js';
import { Variable } from '../variable.js';
import {
    ProcessBuiltinObjectSpecializeList,
    ForEachBuiltinObject,
} from './builtin.js';
import { ModDeclStatement, Statement } from '../statement.js';
import { IdentifierExpression } from '../expression.js';

function processTypes(context: BuildContext, globalScopes: Array<GlobalScope>) {
    for (const scope of globalScopes) {
        scope.traverseScopTree((scope) => {
            context.push(scope);
            scope.namedTypeMap.forEach((type, name) => {
                Logger.debug(`== type: ${name}, ${type.kind}`);
                createType(context, type);
            });
            context.pop();
        });
    }
}

function buildStatements(
    context: BuildContext,
    scopeStmts: Statement[],
): SemanticsNode[] {
    const statements: SemanticsNode[] = [];
    let basic_block: BasicBlockNode | undefined = undefined;

    for (const statement of scopeStmts) {
        if (statement instanceof ModDeclStatement) {
            const nsStmts = generateNamespaceScopeNodes(
                context,
                statement.scope,
            );
            statements.push(...nsStmts);
        } else {
            const r = buildStatement(statement, context);
            if (r instanceof SemanticsValue) {
                if (!basic_block) {
                    basic_block = new BasicBlockNode();
                    statements.push(basic_block);
                }
                basic_block!.pushSemanticsValue(r as SemanticsValue);
            } else {
                basic_block = undefined;
                statements.push(r as SemanticsNode);
            }
        }
    }

    return statements;
}

function processGlobalStatements(context: BuildContext, g: GlobalScope) {
    /* calculate all vars contained in this scope */
    const allVars: Variable[] = [];
    getAllVars(g, allVars, g);

    /* get all global statements, including globalScope's statements and namespaceScope's statements */
    /* Hint: the statements' order can't be guaranteed */
    const globalStartStmts = buildStatements(context, g.statements);

    const curStartStmts = context.startStmts.get(g)!.concat(globalStartStmts);
    context.startStmts.set(g, curStartStmts);

    curStartStmts.forEach((s) => {
        if (s instanceof BasicBlockNode) {
            s.isStartBasicBlock = true;
        }
    });
    const block = new BlockNode(curStartStmts);

    const globalStart = new FunctionDeclareNode(
        g.startFuncName,
        FunctionOwnKind.START,
        GetPredefinedType(PredefinedTypeId.FUNC_VOID_VOID_NONE) as FunctionType,
        block,
    );
    globalStart.debugFilePath = g.debugFilePath;
    if (g === context.enterScope) {
        globalStart.isInEnterScope = true;
    }
    if (g.importStartFuncNameList.length > 0) {
        globalStart.importStartFuncNameList = g.importStartFuncNameList;
    }

    flattenFunction(globalStart);

    context.module.functions.add(globalStart);
}

export function getFunctionOwnKind(f: FunctionScope): number {
    let funcKind = 0;
    if (f.isDeclare()) {
        funcKind |= FunctionOwnKind.DECLARE;
    }
    if (f.isMethod()) {
        funcKind |= FunctionOwnKind.METHOD;
    } else {
        funcKind |= FunctionOwnKind.DEFAULT;
    }
    if (f.isStatic()) {
        funcKind |= FunctionOwnKind.STATIC;
    }
    if (f.isDecorator()) {
        funcKind |= FunctionOwnKind.DECORATOR;
    }
    if (f.isExport()) {
        funcKind |= FunctionOwnKind.EXPORT;
    }
    return funcKind;
}

function getMethodClassType(
    f: FunctionScope,
    context: BuildContext,
): ObjectType | undefined {
    if (!f.parent || f.parent.kind != ScopeKind.ClassScope) return undefined;

    const symbol = context.globalSymbols.get(f.parent!) as ValueType; // get the class type
    if (!symbol || !(symbol instanceof SemanticsValue)) {
        return undefined;
    }

    const type = (symbol! as unknown as SemanticsValue).type;
    if (!(type instanceof ObjectType)) {
        throw Error(
            `${type} must be object of function scope ${f.mangledName}`,
        );
    }
    return type as ObjectType;
}

function createFunctionDeclareNode(
    context: BuildContext,
    f: FunctionScope,
): FunctionDeclareNode {
    let name = f.mangledName; //f.funcName;
    // iff the function is a static member function.
    /**
     * adding a '@' prefix before the static member function name
     * is to distinguish the non-static member function with the same name.
     */
    if (f.className != '' && f.funcType.isStatic) {
        const reverse = name.split('|').reverse();
        reverse[0] = '@' + reverse[0];
        name = reverse.reverse().join('|');
    }

    /* maybe can be replace to context.findSymbolKey(f.funcType) as FunctionType */
    const func_type = createType(context, f.funcType) as FunctionType;
    const this_type = getMethodClassType(f, context);
    const parameters: VarDeclareNode[] = [];
    if (f.genericOwner) {
        const genericOwner = f.genericOwner as FunctionScope;
        const specializedArgs = f.funcType.specializedArguments!;
        genericOwner.paramArray.forEach((v) => {
            const specializedType = TypeResolver.createSpecializedType(
                v.varType,
                specializedArgs,
                (f.genericOwner as FunctionScope).funcType,
            );
            const newParam = new Parameter(
                v.varName,
                specializedType,
                v.varModifiers,
                v.varIndex,
                v.isOptional,
                v.destructuring,
            );
            if (v.initExpression) newParam.setInitExpr(v.initExpression);
            newParam.setIsLocalVar(v.isLocalVar());
            newParam.needReBinding = v.needReBinding;
            newParam.tsNode = v.tsNode;
            f.addParameter(newParam);
        });
        /* at this time, we set parameters for the specialized FunctionScope,
         * so we need to initialize their index once
         */
        f.resetLocalIndex();
        f.initVariableIndex();
        f.initParamIndex();
    }
    const paramArray = f.paramArray;

    for (let i = 0; i < paramArray.length; i++) {
        const p = paramArray[i];
        let p_type: ValueType | undefined = undefined;
        p_type = func_type.argumentsType[i];
        const initValue = p.initExpression
            ? buildExpression(p.initExpression, context)
            : undefined;

        Logger.debug(
            `=== paramter[${i}] ${name} ${p.varName} ${p_type} argument index: ${i}`,
        );
        const param = new VarDeclareNode(
            SemanticsValueKind.PARAM_VAR,
            p_type ?? Primitive.Any,
            p.varName,
            p.varIndex,
            p.isOptional ? ParameterNodeFlag.OPTIONAL : 0,
            initValue,
            p.closureIndex,
            p.belongCtx
                ? createFromVariable(p.belongCtx, false, context)
                : undefined,
            p.initContext
                ? createFromVariable(p.initContext, false, context)
                : undefined,
        );

        parameters.push(param);
    }

    const parentCtx =
        f.parent instanceof ClosureEnvironment
            ? createFromVariable(f.parent.varArray[0], false, context)
            : undefined;
    const func = new FunctionDeclareNode(
        name,
        getFunctionOwnKind(f),
        func_type,
        new BlockNode([]),
        parameters,
        undefined,
        parentCtx,
        f.envParamLen,
        this_type,
    );
    func.debugFilePath = f.debugFilePath;

    return func;
}

function processScopesGlobalObjs(context: BuildContext, scopes: Scope[]) {
    for (const scope of scopes) {
        processGlobalObjs(context, scope);
    }
}

function isInClosureScope(scope: Scope): boolean {
    while (scope.parent) {
        scope = scope.parent!;
        if (scope instanceof ClosureEnvironment) {
            return true;
        }
    }
    return false;
}

function processGlobalObjs(context: BuildContext, scope: Scope) {
    context.push(scope);
    if (scope.kind == ScopeKind.FunctionScope) {
        const func = createFunctionDeclareNode(context, scope as FunctionScope);
        if (scope.parent === context.enterScope) {
            func.isInEnterScope = true;
        }
        Logger.debug(
            `==== processGlobalObjs Function ${scope.getName()} func: ${
                func.name
            }`,
        );

        if (!isInClosureScope(scope)) {
            const var_func = new VarValue(
                SemanticsValueKind.GLOBAL_CONST,
                func.funcType,
                func,
                func.name,
            );

            context.globalSymbols.set(scope, var_func);
            context.addFunctionValue(var_func);
        } else {
            context.globalSymbols.set(scope, func); // save func node only
        }
        context.module.functions.add(func);
    } else if (scope.kind == ScopeKind.ClassScope) {
        const class_scope = scope as ClassScope;
        const type = createType(context, class_scope.classType);
        // create a var value
        const obj_type = type as ObjectType;

        const class_value = new VarValue(
            SemanticsValueKind.GLOBAL_CONST,
            obj_type.classType!,
            obj_type.classType!,
            obj_type.meta.name,
        );
        class_value.shape = obj_type.classType!.meta.originShape;
        // TODO
        context.globalSymbols.set(class_scope, class_value);
        context.globalSymbols.set(class_scope.classType, class_value);
        context.addClassValue(class_value);
    } else if (
        scope.kind == ScopeKind.GlobalScope ||
        scope.kind == ScopeKind.NamespaceScope
    ) {
        // put the scope into symbols table, so that the scope can be import
        const name = scope.mangledName;
        const ns_var = new VarValue(
            SemanticsValueKind.GLOBAL_CONST,
            Primitive.Namespace,
            scope,
            name,
        );
        context.globalSymbols.set(scope, ns_var);

        for (const v of scope.varArray) {
            if (v.isLocalVar()) continue;
            Logger.debug(
                `=== processGlobalVars ${v.mangledName} ${
                    v.varName
                } declare ${v.isDeclare()}`,
            );
            const storage: VarStorageType =
                v.isConst() || v.isReadOnly()
                    ? SemanticsValueKind.GLOBAL_CONST
                    : SemanticsValueKind.GLOBAL_VAR;
            let type = context.module.findValueTypeByType(v.varType);
            //let type = context.findSymbolKey(v.varType) as ValueType;
            if (!type) type = Primitive.Any;

            const var_decl = new VarDeclareNode(
                storage,
                type,
                v.mangledName,
                context.module.globalVars.length,
                0, // TODO: replace with flag: like declare
            );

            const var_value = new VarValue(
                storage,
                type,
                var_decl,
                v.mangledName,
            );

            context.module.globalVars.push(var_decl); // TODO removed
            context.globalSymbols.set(v, var_value);
            context.addGlobalValue(v.mangledName, var_value);
        }
    }

    processScopesGlobalObjs(context, scope.children);
    context.pushTask(() => context.pop());
}

function InitGlobalObj(context: BuildContext, g: GlobalScope) {
    for (const v of g.varArray) {
        if (v.isLocalVar()) continue;
        Logger.debug(
            `=== InitGlobalObj ${v.mangledName} ${
                v.varName
            } declare ${v.isDeclare()}`,
        );

        const varValue = context.globalSymbols.get(v)! as VarValue;
        let init_value: SemanticsValue | undefined;
        if (v.initExpression != null) {
            init_value = buildExpression(v.initExpression, context);
            if (varValue.ref instanceof VarDeclareNode) {
                varValue.ref.initValue = init_value;
                if (
                    shapeAssignCheck(varValue.effectType, init_value.effectType)
                ) {
                    varValue.shape = init_value.shape;
                }
            }
        }
    }
}

function foreachScopeChildren(context: BuildContext, scope: Scope) {
    for (const c of scope.children) {
        generateScopeNodes(context, c);
    }
}

export function generateChildrenFunctionScope(
    context: BuildContext,
    scope: Scope,
) {
    for (const c of scope.children) {
        if (c.kind == ScopeKind.FunctionScope) {
            generateFunctionScopeNodes(context, c as FunctionScope);
        } else if (c.kind == ScopeKind.ClassScope) {
            generateClassScopeNodes(context, c as ClassScope);
        }
    }
}

function getAllVars(
    scope: Scope,
    vars: Variable[],
    belongScope: FunctionScope | GlobalScope,
) {
    if (scope instanceof FunctionScope && scope !== belongScope) {
        return;
    }
    for (const variable of scope.varArray) {
        vars.push(variable);
    }
    for (const child of scope.children) {
        getAllVars(child, vars, belongScope);
    }
}

function generateFunctionScopeNodes(
    context: BuildContext,
    scope: FunctionScope,
) {
    const symbol = context.globalSymbols.get(scope);
    let func: FunctionDeclareNode | undefined = undefined;
    if (symbol) {
        if (symbol instanceof VarValue) {
            const var_value = symbol as VarValue;
            if (var_value.type.kind == ValueTypeKind.FUNCTION) {
                func = var_value.ref as FunctionDeclareNode;
            }
        } else if (symbol instanceof FunctionDeclareNode) {
            func = symbol as FunctionDeclareNode;
        }
    }

    if (!func) {
        func = createFunctionDeclareNode(context, scope);
        context.module.functions.add(func);
    }

    if ((func.ownKind & FunctionOwnKind.DECLARE) !== 0) return;

    Logger.debug(`=======>> begin build function ${func}====`);

    /* build parameter symbols */
    const params = new Map<SymbolKey, SymbolValue>();
    if (func.parameters && func.parameters.length > 0) {
        for (let i = 0; i < scope.paramArray.length; i++) {
            // must use scope.paramArray
            const p = scope.paramArray[i];
            const n = func.parameters[i];
            Logger.debug(`=== params :${p.varName} ${n.toString()}, ${n.type}`);
            params.set(p, new VarValue(n.storageType, n.type, n, n.index));
        }
    }

    /* calculate all vars contained in this scope */
    const allVars: Variable[] = [];
    getAllVars(scope, allVars, scope);

    context.push(scope, params, func);

    const [local_varlist, local_symbols] = createLocalSymbols(scope, context);
    func.varList = local_varlist;

    if (local_symbols) {
        context.updateNamedSymbolByScope(scope, local_symbols);
    }

    generateChildrenFunctionScope(context, scope);

    if (scope.genericOwner) {
        scope.genericOwner.statements.forEach((s) => {
            scope.addStatement(s);
        });
    }
    const statements = buildStatements(context, scope.statements);
    func.body.statements = statements;

    context.pop();

    flattenFunction(func);

    Logger.debug(`=======<< end build function ${func}====`);
}

function generateClassScopeNodes(context: BuildContext, scope: ClassScope) {
    foreachScopeChildren(context, scope);
}

function generateBlockScopeNodes(context: BuildContext, scope: BlockScope) {
    return;
}

function generateNamespaceScopeNodes(
    context: BuildContext,
    scope: NamespaceScope,
) {
    context.push(scope);
    /* Handle statements in namespaceScope */
    const nsStartStmts = buildStatements(context, scope.statements);
    context.pop();
    return nsStartStmts;
}

function generateScopeNodes(context: BuildContext, scope: Scope) {
    switch (scope.kind) {
        case ScopeKind.FunctionScope:
            generateFunctionScopeNodes(context, scope as FunctionScope);
            break;
        case ScopeKind.ClassScope:
            generateClassScopeNodes(context, scope as ClassScope);
            break;
        case ScopeKind.BlockScope:
            generateBlockScopeNodes(context, scope as BlockScope);
            break;
        default:
            foreachScopeChildren(context, scope);
            break;
    }
}

function processGlobals(context: BuildContext, parserContext: ParserContext) {
    context.enterScope =
        parserContext.globalScopes[parserContext.globalScopes.length - 1];
    processTypes(context, parserContext.globalScopes);

    processScopesGlobalObjs(context, parserContext.globalScopes);

    /* must call brfore processObjectDescriptions,
       so we can ensure that the meta information has been completed before creating the shape
    */
    context.runAllTasks();

    processObjectDescriptions(context);

    processImportsExports(context, parserContext);

    for (const g of parserContext.globalScopes) {
        context.push(g);
        context.startStmts.set(g, []);
        // global variables may be processed in the 'generateScopeNodes' function.
        // So we need to initialize global variables before using them.
        InitGlobalObj(context, g);
        generateScopeNodes(context, g);
        processGlobalStatements(context, g);
        context.pop();
    }
}

function addImportNamespaceItems(
    context: BuildContext,
    ns: NamespaceScope,
    m: ExternModule,
    name: string,
) {
    const ns_delcared = ns.isDeclare();

    for (const v of ns.varArray) {
        if (ns_delcared || v.isDeclare()) {
            const found = context.findSymbolKey(v);
            if (found)
                addExternItem(context, m, `${name}|${v.varName}`, found, true);
        }
    }

    // add the scopes
    for (const scope of ns.children) {
        if (!(ns_delcared || scope.isDeclare())) continue;

        switch (scope.kind) {
            case ScopeKind.FunctionScope: {
                const found = context.findSymbolKey(scope);
                if (found)
                    addExternItem(
                        context,
                        m,
                        `${name}|${(scope as FunctionScope).funcName}`,
                        found,
                        true,
                    );
                break;
            }
            case ScopeKind.ClassScope: {
                const found = context.findSymbolKey(scope);
                if (found)
                    addExternItem(
                        context,
                        m,
                        `${name}|${(scope as ClassScope).className}`,
                        found,
                        true,
                    );
                break;
            }
            case ScopeKind.NamespaceScope: {
                addImportNamespaceItems(
                    context,
                    scope as NamespaceScope,
                    m,
                    `${name}|${scope.getName()}`,
                );
                break;
            }
        }
    }
}

function addExportNamespaceItems(
    context: BuildContext,
    ns: NamespaceScope,
    m: ExternModule,
    name: string,
) {
    const ns_export = ns.isExport();

    // add the variable
    for (const v of ns.varArray) {
        if (ns_export || v.isExport()) {
            const found = context.findSymbolKey(v);
            if (found)
                addExternItem(context, m, `${name}|${v.varName}`, found, false);
        }
    }

    // add the scopes
    for (const scope of ns.children) {
        if (!(ns_export || scope.isExport())) continue;

        switch (scope.kind) {
            case ScopeKind.FunctionScope: {
                const found = context.findSymbolKey(scope);
                if (found)
                    addExternItem(
                        context,
                        m,
                        `${name}|${(scope as FunctionScope).funcName}`,
                        found,
                        false,
                    );
                break;
            }
            case ScopeKind.ClassScope: {
                const found = context.findSymbolKey(scope);
                if (found)
                    addExternItem(
                        context,
                        m,
                        `${name}|${(scope as ClassScope).className}`,
                        found,
                        false,
                    );
                break;
            }
            case ScopeKind.NamespaceScope: {
                addExportNamespaceItems(
                    context,
                    scope as NamespaceScope,
                    m,
                    `${name}|${scope.getName()}`,
                );
                break;
            }
        }
    }
}

function addExternItem(
    context: BuildContext,
    m: ExternModule,
    name: string,
    value: SymbolValue,
    isImport: boolean,
) {
    let kind: ExternTypeKind;

    let rel_val: any = value;

    if (value instanceof VarValue) {
        const var_val = value as VarValue;
        if (
            var_val.kind == SemanticsValueKind.GLOBAL_VAR ||
            var_val.kind == SemanticsValueKind.GLOBAL_CONST
        ) {
            rel_val = var_val.ref;
        } else {
            throw Error(
                `Only Global value can be import export: ${value} in module ${m.name}`,
            );
        }
    }

    if (rel_val instanceof VarDeclareNode) {
        kind = ExternTypeKind.VAR;
    } else if (rel_val instanceof FunctionDeclareNode) {
        kind = ExternTypeKind.FUNCTION;
    } else if (rel_val instanceof EnumType) {
        kind = ExternTypeKind.ENUM;
    } else if (rel_val instanceof ObjectType) {
        const obj_type = rel_val as ObjectType;
        if (obj_type.kind == ValueTypeKind.ARRAY)
            return; // ignore the builtin export/import
        else if (obj_type.classType) kind = ExternTypeKind.CLASS;
        else if (obj_type.isLiteralObject()) kind = ExternTypeKind.VAR;
        else return; // ignore the interface
    } else if (rel_val instanceof NamespaceScope) {
        // NAMESPACE
        if (isImport)
            addImportNamespaceItems(
                context,
                rel_val as NamespaceScope,
                m,
                name,
            );
        else
            addExportNamespaceItems(
                context,
                rel_val as NamespaceScope,
                m,
                name,
            );
        return;
    } else {
        Logger.info(`Type ${value} export or import in module ${m.name}`);
        return;
    }

    Logger.debug(
        `=== Add${m.isImport ? 'Import' : 'Export'} ${m.name} ${name} ${
            ExternTypeKind[kind]
        } ${rel_val} `,
    );
    m.addItem(kind, name, rel_val as ExternType);
}

function processImportsExports(
    context: BuildContext,
    parserContext: ParserContext,
) {
    const module = context.module;
    const exports = module.exports;
    const imports = module.imports;
    for (const g of parserContext.globalScopes) {
        const exportList = g.exportIdentifierList;
        const importList = g.declareIdentifierList;
        context.push(g);
        if (exportList.length > 0) {
            const export_module = new ExternModule(g.moduleName, false);
            for (const id of exportList) {
                let ret_val: SymbolValue | undefined;
                let export_name: string;
                // TODO process export xxx from '<module>';
                if (id instanceof IdentifierExpression) {
                    ret_val = context.findSymbol(id.identifierName);
                    export_name = id.identifierName;
                    if (!ret_val) {
                        throw Error(
                            `Cannot find the export "${id}" in "${g.moduleName}"`,
                        );
                    }
                    if (
                        ret_val instanceof VarValue &&
                        ret_val.ref instanceof FunctionDeclareNode &&
                        g == context.enterScope
                    ) {
                        ret_val.ref.isInEnterScope = true;
                    }
                } else {
                    ret_val = buildExpression(id, context);
                    export_name = id.expressionKind.toString();
                }
                addExternItem(
                    context,
                    export_module,
                    export_name,
                    ret_val!,
                    false,
                );
            }
            exports.add(export_module);
        }

        if (importList.size > 0) {
            const import_module = new ExternModule(g.moduleName, true);
            for (const id of importList) {
                const ret_val = context.findSymbol(id);
                if (!ret_val) {
                    throw Error(
                        `Cannot find the import "${id}" in "${g.moduleName}"`,
                    );
                }
                addExternItem(context, import_module, id, ret_val!, true);
            }
            imports.add(import_module);
        }
        context.pop();
    }
}

function processObjectDescriptions(context: BuildContext) {
    // generate the originShape
    context.objectDescriptions.forEach((meta, name) => {
        createObjectDescriptionShapes(context, meta);
    });

    ForEachBuiltinObject((obj_type: ObjectType) => {
        createObjectDescriptionShapes(context, obj_type.instanceType!.meta);
        createObjectDescriptionShapes(context, obj_type.classType!.meta);
    });

    ProcessBuiltinObjectSpecializeList();
}

function setRecArraySize(recClass: TSClass[][], recObjectType: ObjectType[][]) {
    if (recClass.length == 0) {
        return recObjectType;
    }
    recObjectType = new Array<ObjectType[]>(recClass.length);

    for (let i = 0; i < recClass.length; ++i) {
        recObjectType[i] = new Array<ObjectType>(recClass[i].length);
    }
    return recObjectType;
}

/** to avoid interface in rec circles */
function removeRecWhichHasInfc(recGroupTypes: TSClass[][]) {
    const recGroupTypesNew: TSClass[][] = [];
    if (recGroupTypes.length == 0) {
        return recGroupTypesNew;
    }

    for (let i = 0; i < recGroupTypes.length; ++i) {
        let hasInfc = false;
        for (let j = 0; j < recGroupTypes[i].length; ++j) {
            if (recGroupTypes[i][j] instanceof TSInterface) {
                hasInfc = true;
                break;
            }
        }
        if (!hasInfc) {
            recGroupTypesNew.push(recGroupTypes[i]);
        }
    }
    return recGroupTypesNew;
}

export function BuildModuleNode(parserContext: ParserContext): ModuleNode {
    const module = new ModuleNode();
    const context = new BuildContext(parserContext.typeId, module);

    context.recClassTypeGroup = removeRecWhichHasInfc(
        parserContext.recGroupTypes,
    );
    parserContext.recGroupTypes = [];
    context.module.recObjectTypeGroup = setRecArraySize(
        context.recClassTypeGroup,
        context.module.recObjectTypeGroup,
    );
    processGlobals(context, parserContext);

    context.finishBuild();

    // module.dump(CreateDefaultDumpWriter());
    // module.dumpCodeTrees(CreateDefaultDumpWriter());
    context.recClassTypeGroup = [];
    return module;
}
