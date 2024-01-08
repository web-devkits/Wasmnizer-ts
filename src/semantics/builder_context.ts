/*

 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

import { Logger } from '../log.js';

import {
    Scope,
    ScopeKind,
    NamespaceScope,
    GlobalScope,
    FunctionScope,
    importSearchTypes,
    ClassScope,
} from '../scope.js';

import { Variable } from '../variable.js';

import { Type, TypeKind, TSClass } from '../type.js';

import { SemanticsValue, SemanticsValueKind, VarValue } from './value.js';

import { ObjectType, ValueType } from './value_types.js';

import {
    SemanticsNode,
    ModuleNode,
    FunctionDeclareNode,
    VarDeclareNode,
} from './semantics_nodes.js';

import { ObjectDescriptionType, ObjectDescription } from './runtime.js';
import { clearBuiltinTypes, clearSpecializeList } from './builtin.js';
import { CustomTypeId } from '../utils.js';
import { Expression } from '../expression.js';
import { buildExpression } from './expression_builder.js';

export type SymbolKey = Variable | Scope | Type | Expression;
export type SymbolValue = SemanticsValue | ValueType | SemanticsNode;

export interface BuildEnv {
    scope: Scope;
    symbols: Map<SymbolKey, SymbolValue>;
    tmpVarLen: number;
    varsLen: number;
    namedSymbols?: Map<string, SymbolValue>;
    function?: FunctionDeclareNode;
    closures?: Map<SymbolKey, VarValue>;
}

export enum ValueReferenceKind {
    LEFT,
    RIGHT,
}

export function SymbolKeyToString(key?: SymbolKey): string {
    if (!key) return 'NULL';

    if (key! instanceof Variable) {
        const v = key! as Variable;
        const scope = SymbolKeyToString(v.scope ?? undefined);
        return `[VAR ${v.varName}(${v.mangledName}) ${SymbolKeyToString(
            v.varType,
        )}  ${scope}]`;
    } else if (key! instanceof Type) {
        const t = key! as Type;
        if (key.kind == TypeKind.CLASS)
            return `[Class ${(t as TSClass).typeId}]`;
        return `[Type ${t.kind}]`;
    } else if (key! instanceof Scope) {
        const s = key! as Scope;
        return `[Scope: ${s.kind} ${s.getName()}]`;
    }
    return `Unknown type ${key}`;
}

export interface Task {
    (): void;
}

export class BuildContext {
    globalSymbols: Map<SymbolKey, SymbolValue> = new Map();

    private tasks: Task[] = [];

    public objectDescriptions = new Map<string, ObjectDescription>();
    // remember the named class, functions
    public namedGlobalValues = new Map<string, SemanticsValue>();
    public enterScope: GlobalScope | undefined = undefined;
    public startStmts = new Map<GlobalScope, SemanticsNode[]>();
    public recClassTypeGroup = new Array<TSClass[]>();
    // record objectDescription and corresponding objectType
    public metaAndObjectTypeMap = new Map<ObjectDescription, ObjectType>();

    addFunctionValue(var_func: VarValue) {
        this.namedGlobalValues.set(var_func.index as string, var_func);
    }

    addClassValue(var_class: VarValue) {
        this.namedGlobalValues.set(var_class.index as string, var_class);
    }

    addGlobalValue(name: string, v: VarValue) {
        this.namedGlobalValues.set(name, v);
    }

    getGlobalValue(name: string): SemanticsValue | undefined {
        return this.namedGlobalValues.get(name);
    }

    pushTask(task: Task) {
        this.tasks.push(task);
    }

    runAllTasks() {
        while (this.tasks.length > 0) {
            const task = this.tasks.shift();
            if (task) task();
        }
    }

    stackEnv: BuildEnv[] = [];
    valueReferenceStack: ValueReferenceKind[] = [];

    constructor(private typeIdx: number, public module: ModuleNode) {}

    nextTypeId(): number {
        const typeId = this.typeIdx;
        this.typeIdx++;
        return typeId;
    }

    currentReference(): ValueReferenceKind {
        if (this.valueReferenceStack.length == 0)
            return ValueReferenceKind.RIGHT;

        return this.valueReferenceStack[this.valueReferenceStack.length - 1];
    }

    pushReference(type: ValueReferenceKind) {
        this.valueReferenceStack.push(type);
    }
    popReference() {
        this.valueReferenceStack.pop();
    }

    push(
        scope: Scope,
        symbols?: Map<SymbolKey, SymbolValue>,
        func?: FunctionDeclareNode,
    ) {
        const env: BuildEnv = {
            scope: scope,
            symbols: symbols ? symbols : new Map(),
            tmpVarLen: 0,
            varsLen: 0,
            function: func ? func : undefined,
        };
        this.updateNamedSymbol(env);
        this.stackEnv.push(env);
    }

    pop() {
        this.stackEnv.pop();
    }

    top(): BuildEnv {
        return this.stackEnv[this.stackEnv.length - 1];
    }

    updateNamedSymbolByScope(
        scope: Scope,
        symbols: Map<SymbolKey, SymbolValue>,
    ) {
        for (let i = this.stackEnv.length - 1; i >= 0; i--) {
            if (this.stackEnv[i].scope === scope) {
                symbols.forEach((value, key) => {
                    this.stackEnv[i].symbols.set(key, value);
                });
                this.updateNamedSymbol(this.stackEnv[i]);
                break;
            }
        }
    }

    updateNamedSymbol(env: BuildEnv) {
        if (!env.namedSymbols) env.namedSymbols = new Map();
        env.symbols.forEach((v, k) => {
            let symbolName: string | undefined = undefined;
            if (k instanceof Variable) {
                symbolName = (k as Variable).varName;
            } else if (k instanceof Scope) {
                symbolName = (k as Scope).getName();
            }
            if (symbolName) {
                env.namedSymbols!.set(symbolName, v);
            }
        });
    }

    private getOwnerFunctionEnv(idx: number): BuildEnv | undefined {
        if (idx >= this.stackEnv.length) return undefined;
        for (let i = idx; i >= 0; i--) {
            if (this.stackEnv[i].function) return this.stackEnv[i];
        }
        return undefined;
    }

    currentFunction(): FunctionDeclareNode | undefined {
        const env = this.getOwnerFunctionEnv(this.stackEnv.length - 1);
        return env ? env.function : undefined;
    }

    getScopeNamespace(): string {
        const ns: string[] = [];
        for (let i = this.stackEnv.length - 1; i >= 0; i--) {
            const scope = this.stackEnv[i].scope;
            if (scope.kind == ScopeKind.GlobalScope) {
                ns.unshift((scope as GlobalScope).moduleName);
            } else if (scope.kind == ScopeKind.NamespaceScope) {
                ns.unshift((scope as NamespaceScope).getName());
            }
        }
        return ns.join('|');
    }

    private getSymbolKeyByName(
        id: string,
        search_type = importSearchTypes.All,
    ): SymbolKey | undefined {
        const scope = this.top().scope;
        return scope.findIdentifier(id, true, search_type);
    }

    findSymbol(
        id: string,
        search_type = importSearchTypes.All,
    ): SymbolValue | undefined {
        const name = this.getSymbolKeyByName(id, search_type);
        if (!name) {
            Logger.error(`Unknown identifier name "${name}"`);
            return undefined;
        }
        return this.findSymbolKey(name!);
    }

    findVariable(id: string): SymbolValue | undefined {
        return this.findSymbol(id, importSearchTypes.Variable);
    }

    findType(id: string): SymbolValue | undefined {
        return this.findSymbol(id, importSearchTypes.Type);
    }

    findFunction(id: string): SymbolValue | undefined {
        return this.findSymbol(id, importSearchTypes.Function);
    }

    findNamespace(id: string): SymbolValue | undefined {
        return this.findSymbol(id, importSearchTypes.Namespace);
    }

    findSymbolKey(name: SymbolKey): SymbolValue | undefined {
        if (name instanceof Expression) {
            return buildExpression(name, this);
        }
        let found: SymbolValue | undefined = undefined;
        const curFunc = this.currentFunction();
        for (let i = this.stackEnv.length - 1; i >= 0; i--) {
            const env = this.stackEnv[i];
            Logger.debug(
                `=== findSymbolKey scope[${i}] ${SymbolKeyToString(
                    env.scope,
                )}, ${env.symbols}`,
            );
            env.symbols.forEach((v, k) =>
                Logger.debug(
                    `=== findSymbolKey symbols ${SymbolKeyToString(
                        k,
                    )}, ${v.toString()}`,
                ),
            );
            found = env.symbols.get(name);
            if (!found && env.closures) {
                // try find in closure
                found = env.closures.get(name);
            }
            if (found && found instanceof VarValue) {
                const env = this.getOwnerFunctionEnv(i);
                if (curFunc && env && curFunc !== env!.function) {
                    // we found a closure to build the closure
                    return this.buildClosure(
                        name as Variable,
                        i,
                        found as VarValue,
                        env.scope as FunctionScope,
                        curFunc,
                    );
                }
            }
            if (found) return found;
        }

        found = this.globalSymbols.get(name);
        if (found) return found;

        if (name instanceof Type) {
            found = this.module.findValueTypeByType(name as Type);
        }

        return found;
    }

    private buildClosure(
        name: Variable,
        env_idx: number,
        value: VarValue,
        ownScope: FunctionScope,
        curFunc: FunctionDeclareNode,
    ): VarValue {
        if (
            value.kind == SemanticsValueKind.GLOBAL_VAR ||
            value.kind == SemanticsValueKind.GLOBAL_CONST
        ) {
            return value;
        }
        if (!(value.ref instanceof VarDeclareNode)) return value;

        const var_decl = value.ref as VarDeclareNode;
        var_decl.setUsedByClosureFunction();

        let new_var_decl = var_decl;
        let newValue = value;

        ownScope = ownScope.getRootFunctionScope()!;
        for (let i = env_idx + 1; i < this.stackEnv.length; i++) {
            const env = this.stackEnv[i];
            if (env.function) {
                /* Closure variables can only be used within the same rootFunction */
                if (env.scope.getRootFunctionScope()! === ownScope) {
                    /* The found varDeclareNode needs a deep copy, since the arribute is different between various scopes */
                    new_var_decl = var_decl.copy();
                    new_var_decl.setUsedByClosureFunction();
                    new_var_decl.curCtx = env.function.varList![0];
                    newValue = value.copy();
                    newValue.ref = new_var_decl;
                    env.function.pushClosureVarDeclare(new_var_decl);
                    if (!env.closures)
                        env.closures = new Map<SymbolKey, VarValue>();
                    env.closures!.set(name, newValue);
                }
            }
        }
        return newValue;
    }

    findValueTypeByKey(name: SymbolKey): ValueType | undefined {
        const value = this.findSymbolKey(name);
        if (!value) return undefined;
        if (value instanceof ValueType) return value as ValueType;
        if (value instanceof VarDeclareNode)
            return (value as VarDeclareNode).type;
        if (value instanceof SemanticsValue)
            return (value as SemanticsValue).type;
        return undefined;
    }

    findValueType(type: Type): ValueType | undefined {
        if (type.kind == TypeKind.CLASS || type.kind == TypeKind.INTERFACE) {
            const clazz = type as TSClass;
            let mangledName = clazz.mangledName;
            if (mangledName.length == 0) mangledName = clazz.className;
            return this.module.namedTypes.get(mangledName);
        }
        return this.findValueTypeByKey(type);
    }

    setNamedValueType(name: string, vt: ValueType) {
        this.module.namedTypes.set(name, vt);
    }

    getNamedValueType(name: string): ValueType | undefined {
        return this.module.namedTypes.get(name);
    }

    buildClosureInitList(func: FunctionDeclareNode): VarValue[] | undefined {
        const closure_decl = func.closureVars;
        if (!closure_decl) return undefined;
        const init_list = new Array(closure_decl!.length);
        for (let i = this.stackEnv.length - 1; i >= 0; i--) {
            const env = this.stackEnv[i];
            env.symbols.forEach((v, k) => {
                if (
                    v instanceof VarValue &&
                    (v as VarValue).ref instanceof VarDeclareNode
                ) {
                    const val = v as VarValue;
                    const var_decl = val.ref as VarDeclareNode;
                    if (var_decl.isUsedInClosureFunction()) {
                        const idx = func.findClosureIndex(var_decl);
                        if (idx >= 0) init_list[idx] = val;
                    }
                }
            });

            if (env.closures) {
                env.closures.forEach((v, k) => {
                    const decl = v.ref as VarDeclareNode;
                    if (decl.isUsedInClosureFunction()) {
                        const idx = closure_decl!.indexOf(decl);
                        if (idx >= 0) init_list[idx] = v;
                    }
                });
            }
        }
        return init_list;
    }

    finishBuild() {
        this.objectDescriptions.forEach((od, key) => {
            this.module.objectDescriptions.push(od);
        });
        this.namedGlobalValues.forEach((v, _) => {
            if (v.valueAccessCount > 0)
                this.module.globalValues.push(v as VarValue);
        });

        // clearBuiltinTypes();
        clearSpecializeList();
    }
}
