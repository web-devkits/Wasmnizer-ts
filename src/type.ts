/*
 * Copyright (C) 2023 Intel Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import { ParserContext } from './frontend.js';
import {
    BlockScope,
    ClassScope,
    ClosureEnvironment,
    FunctionScope,
    GlobalScope,
    NamespaceScope,
    Scope,
    ScopeKind,
} from './scope.js';
import { Parameter, Variable } from './variable.js';
import { Expression, IdentifierExpression } from './expression.js';
import { Logger } from './log.js';
import {
    DefaultTypeId,
    createClassScopeByClassType,
    createFunctionScopeByFunctionType,
    isTypeGeneric,
} from './utils.js';
import { TypeError, UnimplementError } from './error.js';
import { BuiltinNames } from '../lib/builtin/builtin_name.js';
import { UnionType } from './semantics/value_types.js';

export const enum TypeKind {
    VOID = 'void',
    BOOLEAN = 'boolean',
    NUMBER = 'number',
    ANY = 'any',
    UNDEFINED = 'undefined',
    STRING = 'string',
    ARRAY = 'array',
    FUNCTION = 'function',
    CLASS = 'class',
    ENUM = 'enum',
    NULL = 'null',
    INTERFACE = 'interface',
    UNION = 'unoin',

    WASM_I32 = 'i32',
    WASM_I64 = 'i64',
    WASM_F32 = 'f32',
    WASM_F64 = 'f64',
    WASM_ANYREF = 'anyref',

    GENERIC = 'generic',
    UNKNOWN = 'unknown',

    CONTEXT = 'context',
    TYPE_PARAMETER = 'type_parameter',
}

export class Type {
    protected typeKind = TypeKind.UNKNOWN;
    isPrimitive = false;
    isWasmType = false;

    get kind(): TypeKind {
        return this.typeKind;
    }

    toString(): string {
        return `TYPE(${this.typeKind})`;
    }

    get isDeclare(): boolean {
        return false;
    }
}

export class WasmType extends Type {
    name: string;

    constructor(private type: string) {
        super();
        this.name = type;
        this.isWasmType = true;
        switch (type) {
            case 'i32': {
                this.typeKind = TypeKind.WASM_I32;
                break;
            }
            case 'i64': {
                this.typeKind = TypeKind.WASM_I64;
                break;
            }
            case 'f32': {
                this.typeKind = TypeKind.WASM_F32;
                break;
            }
            case 'f64': {
                this.typeKind = TypeKind.WASM_F64;
                break;
            }
            case 'anyref': {
                this.typeKind = TypeKind.WASM_ANYREF;
                break;
            }
            default: {
                this.typeKind = TypeKind.UNKNOWN;
                break;
            }
        }
    }

    public getName(): string {
        return this.name;
    }
}

export class GenericType extends Type {
    constructor() {
        super();
        this.typeKind = TypeKind.GENERIC;
    }
}

export class Primitive extends Type {
    constructor(private type: string) {
        super();
        this.isPrimitive = true;
        switch (type) {
            case 'number': {
                this.typeKind = TypeKind.NUMBER;
                break;
            }
            case 'string': {
                this.typeKind = TypeKind.STRING;
                break;
            }
            case 'boolean': {
                this.typeKind = TypeKind.BOOLEAN;
                break;
            }
            case 'any': {
                this.typeKind = TypeKind.ANY;
                break;
            }
            case 'undefined': {
                this.typeKind = TypeKind.UNDEFINED;
                break;
            }
            case 'void': {
                this.typeKind = TypeKind.VOID;
                break;
            }
            case 'null': {
                this.typeKind = TypeKind.NULL;
                break;
            }
            default: {
                this.typeKind = TypeKind.UNKNOWN;
            }
        }
    }
    toString(): string {
        return this.type;
    }
}

export class TSContext extends Type {
    constructor(
        public parentCtxType?: TSContext,
        public freeVarTypeList: Type[] = [],
    ) {
        super();
        this.typeKind = TypeKind.CONTEXT;
    }

    toString(): string {
        const typeName = 'ContextType';
        if (this.parentCtxType) {
            typeName.concat('_');
            typeName.concat(this.parentCtxType.toString());
        }
        for (const freeVarType of this.freeVarTypeList) {
            typeName.concat('_');
            typeName.concat(freeVarType.toString());
        }
        return typeName;
    }
}

export const builtinTypes = new Map<string, Type>([
    ['number', new Primitive('number')],
    ['string', new Primitive('string')],
    ['boolean', new Primitive('boolean')],
    ['any', new Primitive('any')],
    ['undefined', new Primitive('undefined')],
    ['void', new Primitive('void')],
    ['null', new Primitive('null')],
    ['undefined', new Primitive('undefined')],
    ['generic', new GenericType()],
]);

export const builtinWasmTypes = new Map<string, WasmType>([
    ['i32', new WasmType('i32')],
    ['f32', new WasmType('f32')],
    ['i64', new WasmType('i64')],
    ['f64', new WasmType('f64')],
    ['anyref', new WasmType('anyref')],
]);

// type for template
export class TSTypeParameter extends Type {
    typeKind = TypeKind.TYPE_PARAMETER;
    private _name: string; // the name of TypeParameter
    private _wide: Type; // the wide type of this type parameter
    private _default?: Type; // the default type of this type parameter
    private _index: number; // the declaration index, important!

    constructor(name: string, wide: Type, index: number, def?: Type) {
        super();
        this._name = name;
        this._wide = wide;
        this._index = index;
        this._default = def;
    }

    get name(): string {
        return this._name;
    }

    get wideType(): Type {
        return this._wide;
    }

    get index(): number {
        return this._index;
    }

    get defaultType(): Type | undefined {
        return this._default;
    }

    toString(): string {
        return `TypeParameter(${this._name} wide:${this._wide} default: ${this._default})`;
    }
}

export interface TsClassField {
    name: string;
    type: Type;
    modifier?: 'readonly';
    visibility?: 'public' | 'protected' | 'private';
    static?: 'static';
    optional?: boolean;
}

export const enum FunctionKind {
    DEFAULT = 'default',
    CONSTRUCTOR = 'constructor',
    METHOD = 'method',
    GETTER = 'getter',
    SETTER = 'setter',
    STATIC = 'static',
}

export function getMethodPrefix(kind: FunctionKind): string {
    switch (kind) {
        case FunctionKind.CONSTRUCTOR:
            return 'constructor';
        case FunctionKind.GETTER:
            return 'get_';
        case FunctionKind.SETTER:
            return 'set_';
        default:
            return '';
    }
}

export interface TsClassFunc {
    name: string;
    type: TSFunction;
    optional?: boolean;
}

export interface ClassMethod {
    index: number;
    method: TsClassFunc | null;
}

export class TSTypeWithArguments extends Type {
    private _typeArguments?: TSTypeParameter[];
    private _specializedArguments?: Type[];
    private _genericOwner?: TSTypeWithArguments;
    private _belongedScope?: Scope;

    constructor() {
        super();
    }

    get typeArguments(): TSTypeParameter[] | undefined {
        return this._typeArguments;
    }

    addTypeParameter(type: TSTypeParameter) {
        if (!this._typeArguments) this._typeArguments = [];

        this._typeArguments.push(type); // ignore the index
    }

    setTypeParameters(types: TSTypeParameter[] | undefined) {
        this._typeArguments = types;
    }

    getTypeParameter(name: string): TSTypeParameter | undefined {
        if (this._typeArguments) {
            const param = this._typeArguments.find((p) => p.name == name);
            if (param) return param;
        }
        return undefined;
    }

    get genericOwner(): TSTypeWithArguments | undefined {
        return this._genericOwner;
    }

    setGenericOwner(owner: TSTypeWithArguments | undefined) {
        this._genericOwner = owner;
    }

    get belongedScope(): Scope | undefined {
        return this._belongedScope;
    }

    setBelongedScope(scope: Scope | undefined) {
        this._belongedScope = scope;
    }

    get specializedArguments(): Type[] | undefined {
        return this._specializedArguments;
    }

    setSpecializedArguments(types: Type[] | undefined) {
        this._specializedArguments = types;
    }
}

const enum TraverseStatus {
    NOTVISITTED,
    VISITTED,
    PROCESSED,
}

export class TSClass extends TSTypeWithArguments {
    typeKind = TypeKind.CLASS;
    traverseStatus = TraverseStatus.NOTVISITTED;
    private _typeId = DefaultTypeId;
    private _name = '';
    private _mangledName = '';
    private _memberFields: Array<TsClassField> = [];
    private _staticFields: Array<TsClassField> = [];
    private _methods: Array<TsClassFunc> = [];
    private _baseClass: TSClass | null = null;
    private implInfc: TSInterface | null = null;
    private _isLiteral = false;
    private _ctor: TSFunction | null = null;
    public hasDeclareCtor = true;
    private _isDeclare = false;
    private _numberIndexType?: Type;
    private _stringIndexType?: Type;

    public staticFieldsInitValueMap: Map<number, Expression> = new Map();
    /* override or own methods */
    public overrideOrOwnMethods: Set<string> = new Set();

    constructor() {
        super();
        this.typeKind = TypeKind.CLASS;
    }

    toString(): string {
        return `Class(${this._name}(${this._mangledName} ${
            this._isLiteral ? 'Literanl' : ''
        }))`;
    }

    get fields(): Array<TsClassField> {
        return this._memberFields;
    }

    get staticFields(): TsClassField[] {
        return this._staticFields;
    }

    get memberFuncs(): Array<TsClassFunc> {
        return this._methods;
    }

    set ctorType(ctor: TSFunction) {
        this._ctor = ctor;
    }

    get ctorType(): TSFunction {
        return this._ctor!;
    }

    get isDeclare(): boolean {
        return this._isDeclare;
    }

    set isDeclare(value: boolean) {
        this._isDeclare = value;
    }

    get numberIndexType(): Type | undefined {
        return this._numberIndexType;
    }

    setNumberIndexType(type: Type) {
        this._numberIndexType = type;
    }

    get stringIndexType(): Type | undefined {
        return this._stringIndexType;
    }

    setStringIndexType(type: Type) {
        this._stringIndexType = type;
    }

    setBase(base: TSClass): void {
        this._baseClass = base;
    }

    getBase(): TSClass | null {
        return this._baseClass;
    }

    setImplInfc(infc: TSInterface | null): void {
        this.implInfc = infc;
    }

    getImplInfc(): TSInterface | null {
        return this.implInfc;
    }

    addMemberField(memberField: TsClassField): void {
        this._memberFields.push(memberField);
    }

    getMemberField(name: string): TsClassField | null {
        return (
            this._memberFields.find((f) => {
                return f.name === name;
            }) || null
        );
    }

    getMemberFieldIndex(name: string): number {
        return this._memberFields.findIndex((f) => {
            return f.name === name;
        });
    }

    addStaticMemberField(memberField: TsClassField): void {
        this._staticFields.push(memberField);
    }

    getStaticMemberField(name: string): TsClassField | null {
        return (
            this._staticFields.find((f) => {
                return f.name === name;
            }) || null
        );
    }

    getStaticFieldIndex(name: string): number {
        return this._staticFields.findIndex((f) => {
            return f.name === name;
        });
    }

    addMethod(classMethod: TsClassFunc): void {
        classMethod.type.isMethod = true;
        // when sub class inherits the method of the base class, it should not modify the 'belongedClass'.
        if (!classMethod.type.belongedClass)
            classMethod.type.belongedClass = this;
        this._methods.push(classMethod);
    }

    getMethod(
        name: string,
        kind: FunctionKind = FunctionKind.METHOD,
    ): ClassMethod {
        const res = this.memberFuncs.findIndex((f) => {
            return name === f.name && kind === f.type.funcKind;
        });
        if (res !== -1) {
            return { index: res, method: this.memberFuncs[res] };
        }
        return { index: -1, method: null };
    }

    updateMethod(
        name: string,
        kind: FunctionKind = FunctionKind.METHOD,
        funcType: TSFunction,
    ): boolean {
        const res = this.memberFuncs.findIndex((f) => {
            return name === f.name && kind === f.type.funcKind;
        });
        if (res !== -1) {
            this.memberFuncs[res].type = funcType;
            return true;
        }
        return false;
    }

    setClassName(name: string) {
        this._name = name;
    }

    get className(): string {
        return this._name;
    }

    get mangledName(): string {
        return this._mangledName;
    }

    set mangledName(name: string) {
        this._mangledName = name;
    }

    set typeId(id: number) {
        this._typeId = id;
    }

    get typeId() {
        return this._typeId;
    }

    set isLiteral(b: boolean) {
        this._isLiteral = b;
    }

    get isLiteral(): boolean {
        return this._isLiteral;
    }
}

export class TSInterface extends TSClass {
    constructor() {
        super();
        this.typeKind = TypeKind.INTERFACE;
    }
}

export class TSArray extends Type {
    constructor(private _elemType: Type) {
        super();
        this.typeKind = TypeKind.ARRAY;
    }

    get elementType(): Type {
        return this._elemType;
    }

    toString(): string {
        return `Array<${this._elemType}>`;
    }
}

export class TSFunction extends TSTypeWithArguments {
    typeKind = TypeKind.FUNCTION;
    private _parameterTypes: Type[] = [];
    private _isOptionalParams: boolean[] = [];
    private _returnType: Type = new Primitive('void');
    // iff last parameter is rest paremeter
    private _restParamIdex = -1;
    private _isMethod = false;
    private _isDeclare = false;
    private _isStatic = false;
    private _isBinaryenImpl = false;
    private _isExport = false;
    // iff the function is a member function of a class
    private _belongedClass?: TSClass = undefined;

    toString(): string {
        const s: string[] = [];
        this._parameterTypes.forEach((t) => s.push(t.toString()));
        return `Function(${s.join(',')})${this._returnType}`;
    }

    constructor(public funcKind: FunctionKind = FunctionKind.DEFAULT) {
        super();
        this.typeKind = TypeKind.FUNCTION;
    }

    set returnType(type: Type) {
        this._returnType = type;
    }

    get returnType(): Type {
        return this._returnType;
    }

    addParamType(paramType: Type) {
        this._parameterTypes.push(paramType);
    }

    setParamTypes(paramTypes: Type[]) {
        this._parameterTypes = paramTypes;
    }

    getParamTypes(): Type[] {
        return this._parameterTypes;
    }

    addIsOptionalParam(isOptional: boolean) {
        this._isOptionalParams.push(isOptional);
    }

    get isOptionalParams() {
        return this._isOptionalParams;
    }

    set restParamIdx(idx: number) {
        this._restParamIdex = idx;
    }

    get restParamIdx() {
        return this._restParamIdex;
    }

    hasRest() {
        return this._restParamIdex >= 0;
    }

    get isMethod() {
        return this._isMethod;
    }

    set isMethod(value: boolean) {
        this._isMethod = value;
    }

    get isDeclare(): boolean {
        return this._isDeclare;
    }

    set isDeclare(value: boolean) {
        this._isDeclare = value;
    }

    get isBinaryenImpl() {
        return this._isBinaryenImpl;
    }

    set isBinaryenImpl(value: boolean) {
        this._isBinaryenImpl = value;
    }

    get isStatic() {
        return this._isStatic;
    }

    set isStatic(value: boolean) {
        this._isStatic = value;
    }

    get isExport() {
        return this._isExport;
    }

    set isExport(value: boolean) {
        this._isExport = value;
    }

    set belongedClass(clazz: TSClass | undefined) {
        this._belongedClass = clazz;
    }

    get belongedClass() {
        return this._belongedClass;
    }

    // shadow copy, content of parameterTypes and returnType is not copied
    public clone(): TSFunction {
        const func = new TSFunction(this.funcKind);
        func.typeKind = this.typeKind;
        func._isBinaryenImpl = this._isBinaryenImpl;
        func._isDeclare = this._isDeclare;
        func._isExport = this._isExport;
        func._isMethod = this._isMethod;
        func._isOptionalParams = this._isOptionalParams;
        func._isStatic = this._isStatic;
        func._parameterTypes = this._parameterTypes;
        func._restParamIdex = this._restParamIdex;
        func._returnType = this._returnType;
        func.setTypeParameters(this.typeArguments);
        func.setBelongedScope(this.belongedScope);
        func.belongedClass = this.belongedClass;

        return func;
    }
}

export class TSUnion extends Type {
    typeKind = TypeKind.UNION;
    _types: Type[] = [];

    constructor() {
        super();
    }

    get types(): Array<Type> {
        return this._types;
    }

    addType(type: Type) {
        this._types.push(type);
    }

    toString(): string {
        const s: string[] = [];
        this._types.forEach((t) => s.push(t.toString()));
        return `Union(${s.join(' | ')})`;
    }
}

const MixEnumMemberType: Type = (function () {
    const union = new TSUnion();
    union.addType(builtinTypes.get('number')!);
    union.addType(builtinTypes.get('string')!);
    return union;
})();

export class TSEnum extends Type {
    typeKind = TypeKind.ENUM;
    private _name: string;
    private _memberType: Type = builtinTypes.get('undefined')!;
    private _members: Map<string, number | string> = new Map();

    constructor(name: string) {
        super();
        this._name = name;
    }

    get name(): string {
        return this._name;
    }

    get memberType(): Type {
        return this._memberType;
    }

    addMember(name: string, value: number | string) {
        if (this._members.has(name)) {
            throw new TypeError(`EnumMember exist: ${name}`);
        }
        this._members.set(name, value);
        if (this._memberType.kind == TypeKind.UNDEFINED) {
            if (typeof value == 'string') {
                this._memberType = builtinTypes.get('string')!;
            } else {
                this._memberType = builtinTypes.get('number')!;
            }
        } else if (
            (this._memberType.kind == TypeKind.STRING &&
                typeof value != 'string') ||
            (this._memberType.kind == TypeKind.NUMBER &&
                typeof value != 'number')
        ) {
            this._memberType = MixEnumMemberType;
        }
    }

    getMember(name: string): number | string | undefined {
        return this._members.get(name);
    }

    get members(): Map<string, number | string> {
        return this._members;
    }

    toString(): string {
        let i = 0;
        let s = '';
        this._members.forEach((v, k) => {
            if (i < 4) {
                s += k + ',';
                i++;
            } else if (i == 4) {
                s = s + '...';
            }
        });

        return `Enum(${s})`;
    }
}

export class TypeResolver {
    typechecker: ts.TypeChecker | undefined = undefined;
    globalScopes: Array<GlobalScope>;
    currentScope: Scope | null = null;
    nodeScopeMap: Map<ts.Node, Scope>;
    tsTypeMap = new Map<ts.Type, Type>();
    tsDeclTypeMap = new Map<ts.Declaration, Type>();
    tsArrayTypeMap = new Map<ts.Type, Type>();
    builtInTsTypeMap = new Map<ts.Type, Type>();
    private symbolTypeMap = new Map<ts.Node, Type>();
    nodeTypeCache = new Map<ts.Node, Type>();
    specializedTypeCache = new Map<Type, Map<string, Type>[]>();

    private loopEntry: TSClass | null = null;
    private typeRefsMap = new Map<TSClass, Set<TSClass>>();
    /** when parsing class type, its base type must be already parsed */
    private parsedClassTypes = new Set<TSClass>();
    typeParameterStack: TSTypeWithArguments[] = [];

    constructor(private parserCtx: ParserContext) {
        this.nodeScopeMap = this.parserCtx.nodeScopeMap;
        this.globalScopes = this.parserCtx.globalScopes;
    }

    visitSymbolNode(fileList: ts.SourceFile[]) {
        this.typechecker = this.parserCtx.typeChecker;
        for (const file of fileList) {
            ts.forEachChild(file, (node) => {
                this.visitObjectSymbolNode(node);
            });
        }
    }

    visit() {
        /** create Type and add it to scope */
        this.nodeScopeMap.forEach((scope, node) => {
            ts.forEachChild(node, this.visitNode.bind(this));
        });

        /** parse reference relationship */
        this.symbolTypeMap.forEach((type, symbolNode) => {
            if (type instanceof TSClass) {
                this.parseTypeRefRelationship(type as TSClass);
            }
        });

        /** allocate type id for Class/Interface */
        this.symbolTypeMap.forEach((type, symbolNode) => {
            if (type instanceof TSClass) {
                this.typeIdAllocate(type as TSClass);
            }
        });
    }

    /** parse types with symbol value for TSClass */
    private visitObjectSymbolNode(node: ts.Node) {
        let type: Type | undefined = undefined;
        let symbolNode = node;

        if (ts.isClassDeclaration(node)) {
            type = new TSClass();
        } else if (ts.isInterfaceDeclaration(node)) {
            type = new TSInterface();
        } else if (ts.isObjectLiteralExpression(node)) {
            type = new TSClass();
        } else if (
            ts.isVariableDeclaration(node) ||
            ts.isParameter(node) ||
            ts.isTypeLiteralNode(node)
        ) {
            const tsType = this.typechecker!.getTypeAtLocation(node);
            if (this.isObjectLiteral(tsType) || this.isObjectType(tsType)) {
                const symbol = tsType.symbol;
                if (symbol && symbol.declarations) {
                    symbolNode = symbol.declarations[0];
                    type = new TSClass();
                }
            }
        }
        if (type && !this.symbolTypeMap.has(symbolNode)) {
            this.symbolTypeMap.set(symbolNode, type);
        }

        ts.forEachChild(node, this.visitObjectSymbolNode.bind(this));
    }

    private visitNode(node: ts.Node) {
        this.currentScope = this.parserCtx.getScopeByNode(node)!;

        switch (node.kind) {
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.TypeLiteral: {
                const tsType = this.typechecker!.getTypeAtLocation(node);
                let type: Type;
                let symbolNode = node;
                // parse object types circular reference
                if (
                    (this.isObjectLiteral(tsType) ||
                        this.isObjectType(tsType)) &&
                    tsType.symbol &&
                    tsType.symbol.declarations
                ) {
                    symbolNode = tsType.symbol.declarations[0];
                    type = this.symbolTypeMap.get(symbolNode)!;
                    this.parseObjectType(symbolNode, type as TSClass);
                    if (
                        tsType.aliasTypeArguments &&
                        this.noTypeParmeters(tsType.aliasTypeArguments)
                    ) {
                        const aliasTypes = tsType.aliasTypeArguments.map(
                            (t) => {
                                return this.tsTypeToType(t);
                            },
                        );
                        const specificType = TypeResolver.createSpecializedType(
                            type,
                            aliasTypes,
                            type as TSClass,
                        ) as TSClass;
                        specificType.setSpecializedArguments(aliasTypes);
                        specificType.isLiteral = true;
                        // TODO: in this case, specificType can't be recursive
                        this.typeIdAllocate(specificType);
                        this.symbolTypeMap.set(node, specificType);
                        this.parsedClassTypes.add(specificType);
                        this.addTypeToTypeMap(specificType, node);
                    }
                } else {
                    type = this.generateNodeType(symbolNode);
                    // specialization of generic types when using type alias
                    if (
                        tsType.aliasTypeArguments &&
                        this.noTypeParmeters(tsType.aliasTypeArguments) &&
                        type instanceof TSTypeWithArguments
                    ) {
                        const specializedTypes = tsType.aliasTypeArguments.map(
                            (t) => {
                                return this.tsTypeToType(t);
                            },
                        );
                        // generate a name for the new specialized type
                        const typeNames = new Array<string>();
                        specializedTypes.forEach((v) => {
                            typeNames.push(`${v.kind}`);
                        });
                        const typeSignature = '<' + typeNames.join(',') + '>';

                        // if a specialized type already exists
                        const cache = this.specializedTypeCache.get(type);
                        let found: Type | undefined;
                        if (cache) {
                            cache.forEach((v) => {
                                if (v.has(typeSignature)) {
                                    found = v.get(typeSignature);
                                }
                            });
                        }
                        if (found) break;

                        // perform specialization operation
                        type = TypeResolver.createSpecializedType(
                            type,
                            specializedTypes,
                            type,
                        );
                        if (type instanceof TSTypeWithArguments)
                            type.setSpecializedArguments(specializedTypes);
                        const origType = this.generateNodeType(symbolNode);

                        // update specializedTypeCache
                        if (this.specializedTypeCache.has(origType)) {
                            const value = new Map();
                            value.set(typeSignature, type);
                            this.specializedTypeCache
                                .get(origType)!
                                .push(value);
                        } else {
                            const value = new Map();
                            value.set(typeSignature, type);
                            this.specializedTypeCache.set(origType, [value]);
                        }
                    }
                }
                this.tsTypeMap.set(tsType, type);
                this.addTypeToTypeMap(type, symbolNode);
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                const type = this.symbolTypeMap.get(node)!;
                this.parseObjectType(node, type as TSClass);
                this.addTypeToTypeMap(type, node);
                break;
            }
            case ts.SyntaxKind.ClassDeclaration: {
                const classType = this.symbolTypeMap.get(node)!;
                this.parseClassType(
                    node as ts.ClassDeclaration,
                    classType as TSClass,
                );
                this.addTypeToTypeMap(classType, node);
                break;
            }
            case ts.SyntaxKind.InterfaceDeclaration: {
                const infcType = this.symbolTypeMap.get(node)!;
                const type = this.parseInfcType(
                    node as ts.InterfaceDeclaration,
                    infcType as TSInterface,
                );
                this.addTypeToTypeMap(type, node);
                this.symbolTypeMap.set(node, type);
                return;
            }
            case ts.SyntaxKind.UnionType: {
                const tsType = this.typechecker!.getTypeFromTypeNode(
                    node as ts.UnionTypeNode,
                );
                const type = this.parseUnionType(tsType as ts.UnionType);
                this.addTypeToTypeMap(type, node);
                break;
            }
            case ts.SyntaxKind.EnumDeclaration: {
                const type = this.parseEnumType(node as ts.EnumDeclaration);
                this.addTypeToTypeMap(type, node);
                break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction: {
                const type = this.generateNodeType(node);
                this.addTypeToTypeMap(type, node);
                break;
            }
            case ts.SyntaxKind.TypeAliasDeclaration: {
                const typeAliasNode = <ts.TypeAliasDeclaration>node;
                const typeName = typeAliasNode.name.getText();
                const tsType =
                    this.typechecker!.getTypeAtLocation(typeAliasNode);
                const type = this.generateNodeType(typeAliasNode.type);

                if (
                    tsType.aliasTypeArguments &&
                    type instanceof TSTypeWithArguments
                ) {
                    const typeArgs = tsType.aliasTypeArguments.map((t) => {
                        return this.tsTypeToType(t) as TSTypeParameter;
                    });
                    type.setTypeParameters(typeArgs);
                }
                this.currentScope!.addType(typeName, type);
                break;
            }
            case ts.SyntaxKind.CallExpression: {
                // When a generic function is called, it first needs to be specialized
                const callExprNode = <ts.CallExpression>node;
                const origType = this.generateNodeType(callExprNode.expression);
                // iff a generic function is specialized and called
                if (
                    isTypeGeneric(origType) &&
                    callExprNode.expression.kind === ts.SyntaxKind.Identifier
                ) {
                    let typeArguments: Type[] | undefined;

                    // explicitly declare specialization type typeArguments
                    // e.g.
                    //  function genericFunc<T> (v: T){...}
                    //  genericFunc<number>(5);
                    if (callExprNode.typeArguments) {
                        typeArguments = callExprNode.typeArguments.map((t) => {
                            return this.generateNodeType(t);
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
                            return this.generateNodeType(t);
                        });
                        // paramter type
                        const _paramters = (
                            origType as TSFunction
                        ).getParamTypes();

                        // TODO: Handling optional parameters
                        for (let i = 0; i < _paramters.length; i++) {
                            if (_paramters[i].kind == TypeKind.TYPE_PARAMETER) {
                                _typeArguments.push(_arguments[i]);
                            }
                        }
                        typeArguments = _typeArguments;
                    }

                    const typeNames = new Array<string>();
                    typeArguments.forEach((v) => {
                        typeNames.push(`${v.kind}`);
                    });
                    const typeSignature = '<' + typeNames.join(',') + '>';
                    // if a specialized type already exists
                    const cache = this.specializedTypeCache.get(origType);
                    let found;
                    if (cache) {
                        cache.forEach((v) => {
                            if (v.has(typeSignature)) {
                                found = v.get(typeSignature);
                            }
                        });
                    }
                    if (found) break;

                    if (
                        origType instanceof TSFunction &&
                        origType.belongedScope
                    ) {
                        // create a new specialized function type
                        const specializedType =
                            TypeResolver.createSpecializedType(
                                origType,
                                typeArguments,
                                origType as TSFunction,
                            ) as TSFunction;
                        specializedType.setSpecializedArguments(typeArguments);

                        // generate a name for the new specialized FunctionScope
                        const typeNames = new Array<string>();
                        typeArguments.forEach((v) => {
                            typeNames.push(`${v.kind}`);
                        });
                        const typeSignature = '<' + typeNames.join(',') + '>';
                        const newScopeName =
                            origType.belongedScope.getName() + typeSignature;

                        const newFunctionScope =
                            createFunctionScopeByFunctionType(
                                origType.belongedScope as FunctionScope,
                                origType.belongedScope.parent!,
                                specializedType,
                                newScopeName,
                            );
                        specializedType.setBelongedScope(newFunctionScope);
                        origType.belongedScope.parent?.addType(
                            newScopeName,
                            specializedType,
                        );

                        if (this.specializedTypeCache.has(origType)) {
                            const value = new Map();
                            value.set(typeSignature, specializedType);
                            this.specializedTypeCache
                                .get(origType)!
                                .push(value);
                        } else {
                            const value = new Map();
                            value.set(typeSignature, specializedType);
                            this.specializedTypeCache.set(origType, [value]);
                        }
                    }
                }
                break;
            }
            case ts.SyntaxKind.AsExpression: {
                const asExprNode = <ts.AsExpression>node;
                const typeNode = asExprNode.type;
                const type = this.generateNodeType(typeNode);
                this.addTypeToTypeMap(type, node);
                break;
            }
            default:
                break;
        }
        ts.forEachChild(node, this.visitNode.bind(this));
    }

    private addTypeToTypeMap(type: Type, node: ts.Node) {
        let tsTypeString = this.typechecker!.typeToString(
            this.typechecker!.getTypeAtLocation(node),
        );

        const maybeWasmType = TypeResolver.maybeBuiltinWasmType(node);
        if (maybeWasmType) {
            tsTypeString = maybeWasmType.getName();
        }

        if (
            this.currentScope!.kind === ScopeKind.FunctionScope &&
            type.kind === TypeKind.FUNCTION &&
            ts.isFunctionLike(node)
        ) {
            (<FunctionScope>this.currentScope!).setFuncType(type as TSFunction);
            (type as TSFunction).setBelongedScope(this.currentScope!);
        }
        if (ts.isClassDeclaration(node)) {
            this.currentScope!.parent!.addType(tsTypeString, type);
            if (this.currentScope! instanceof ClassScope) {
                this.currentScope!.setClassType(type as TSClass);
                (type as TSClass).setBelongedScope(this.currentScope!);
            }
        } else if (ts.isObjectLiteralExpression(node)) {
            if (this.currentScope!.parent) {
                this.currentScope!.parent!.addType(tsTypeString, type);
            }
            if (this.currentScope! instanceof ClassScope) {
                this.currentScope!.setClassType(type as TSClass);
            }
        } else {
            this.currentScope!.addType(tsTypeString, type);
        }
    }

    generateNodeType(node: ts.Node): Type {
        if (!this.typechecker) {
            this.typechecker = this.parserCtx.typeChecker;
        }
        /* Resolve wasm specific type */
        const maybeWasmType = TypeResolver.maybeBuiltinWasmType(node);
        if (maybeWasmType) {
            return maybeWasmType;
        }
        const cached_type = this.nodeTypeCache.get(node);
        if (cached_type) {
            return cached_type;
        }
        if (ts.isConstructSignatureDeclaration(node)) {
            return this.parseSignature(
                this.typechecker!.getSignatureFromDeclaration(
                    node as ts.ConstructSignatureDeclaration,
                )!,
            );
        }
        if (ts.isCallSignatureDeclaration(node)) {
            return this.parseSignature(
                this.typechecker!.getSignatureFromDeclaration(
                    node as ts.CallSignatureDeclaration,
                )!,
            );
        }
        let tsType = this.typechecker!.getTypeAtLocation(node);
        if ('isThisType' in tsType && (tsType as any).isThisType) {
            /* For "this" keyword, tsc will inference the actual type */
            tsType = this.typechecker!.getDeclaredTypeOfSymbol(tsType.symbol);
        }
        if (this.tsTypeMap.has(tsType)) {
            return this.tsTypeMap.get(tsType)!;
        }
        let type = this.tsTypeToType(tsType);

        /* for example, a: string[] = new Array(), the type of new Array() should be string[]
         instead of any[]*/
        if (type instanceof TSArray) {
            const parentNode = node.parent;
            if (
                ts.isVariableDeclaration(parentNode) ||
                ts.isBinaryExpression(parentNode) ||
                ts.isPropertyDeclaration(parentNode)
            ) {
                type = this.generateNodeType(parentNode);
            }
            if (
                ts.isNewExpression(parentNode) ||
                ts.isArrayLiteralExpression(parentNode)
            ) {
                const parentType = <TSArray>this.generateNodeType(parentNode);
                if (parentType.kind == TypeKind.ANY) {
                    type = parentType;
                } else {
                    type = (<TSArray>this.generateNodeType(parentNode))
                        .elementType;
                }
            }
        }
        this.nodeTypeCache.set(node, type);
        return type;
    }

    public tsTypeToType(type: ts.Type): Type {
        let res: Type | undefined;

        const typeFlag = type.flags;
        let mask = ts.TypeFlags.Number;

        if (typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('number');
        }
        mask = ts.TypeFlags.NumberLiteral;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('number');
        }
        mask = ts.TypeFlags.String;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('string');
        }
        mask = ts.TypeFlags.StringLiteral;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('string');
        }
        mask = ts.TypeFlags.Boolean;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('boolean');
        }
        mask = ts.TypeFlags.BooleanLiteral;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('boolean');
        }
        mask = ts.TypeFlags.Void;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('void');
        }
        mask = ts.TypeFlags.Any;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('any');
        }
        mask = ts.TypeFlags.Undefined;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('undefined');
        }
        mask = ts.TypeFlags.Null;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            res = builtinTypes.get('null');
        }
        mask = ts.TypeFlags.TypeParameter;
        if (!res && typeFlag & mask && !(~typeFlag & mask)) {
            const type_name = type.symbol.getName();
            for (let i = this.typeParameterStack.length - 1; i >= 0; i--) {
                const typeWithArgs = this.typeParameterStack[i];
                const type = typeWithArgs.getTypeParameter(type_name);
                if (type) return type;
            }

            const type_param = this.currentScope!.findType(type_name);
            if (!type_param || type_param.kind != TypeKind.TYPE_PARAMETER) {
                throw new TypeError(
                    `Cannot find the type ${type_name} or it isn't a TypeParameter (${type_param})`,
                );
            }
            return type_param!;
            //return builtinTypes.get('generic')!;
        }
        if (!res && type.symbol && type.symbol.declarations) {
            const typeDecl = type.symbol.declarations[0];
            if (typeDecl.kind == ts.SyntaxKind.EnumDeclaration) {
                res = this.parseEnumType(typeDecl as ts.EnumDeclaration);
            }
        }
        if (!res && type.isUnion()) {
            res = this.parseUnionType(type);
        }
        if (!res && this.isArray(type)) {
            if (!type.typeArguments) {
                throw new TypeError('array type has no type arguments');
            }
            const elemType = this.tsTypeToType(type.typeArguments![0]);
            res = new TSArray(elemType);
        }
        if (
            !res &&
            (this.isTypeReference(type) ||
                this.isInterface(type) ||
                this.isObjectLiteral(type) ||
                this.isObjectType(type))
        ) {
            const decls = type.symbol.declarations;
            if (decls) {
                const decl = type.symbol.declarations![0];
                const tsType = this.symbolTypeMap.get(decl);
                if (!tsType) {
                    throw new TypeError(
                        `class/interface/object type not found, type name <${type.symbol.name}>. `,
                    );
                }
                // Type references (ObjectFlags.Reference)
                if (
                    /* The 'isTypeReference' function uses bit operators to determine whether the type is a Reference
                     * But this result is not always correct
                     */
                    this.isTypeReference(type) &&
                    type.objectFlags == ts.ObjectFlags.Reference
                ) {
                    const typeArguments = this.typechecker!.getTypeArguments(
                        type as ts.TypeReference,
                    ).map((t) => {
                        return this.tsTypeToType(t);
                    });

                    // generate a string signature of typeArguments to facilitate information storage
                    const typeNames = new Array<string>();
                    typeArguments.forEach((v) => {
                        typeNames.push(`${v.kind}`);
                    });
                    const typeSignature = '<' + typeNames.join(',') + '>';

                    // Determine whether a specialized type already exists
                    // If it exists, return it directly
                    const cache = this.specializedTypeCache.get(tsType);
                    if (cache) {
                        let found: Type | undefined;
                        cache.forEach((v) => {
                            if (v.has(typeSignature)) {
                                found = v.get(typeSignature);
                            }
                        });
                        if (found) return found;
                    }

                    res = TypeResolver.createSpecializedType(
                        tsType,
                        typeArguments,
                        tsType as TSClass,
                    );
                    (res as TSClass).setSpecializedArguments(typeArguments);
                    if (this.specializedTypeCache.has(tsType)) {
                        const value = new Map();
                        value.set(typeSignature, res);
                        this.specializedTypeCache.get(tsType)!.push(value);
                    } else {
                        const value = new Map();
                        value.set(typeSignature, res);
                        this.specializedTypeCache.set(tsType, [value]);
                    }
                } else {
                    res = tsType;
                }
            } else if (type.symbol.flags & ts.TypeFlags.Substitution) {
                /** TODO: symbol.declarations == undefined, means type always
                 * has TypeFlags.Substitution flag??
                 */
                res = new TSClass();
            } else {
                throw new TypeError(
                    `class/interface/object type contains neither declarations
                    nor Substitution flag, type name  <${type.symbol.name}>. `,
                );
            }
        }
        if (!res && this.isFunction(type)) {
            const signature = type.getCallSignatures()[0];
            res = this.parseSignature(signature);
        }

        if (!res) {
            Logger.debug(`Encounter un-processed type: ${type.flags}`);
            res = new Type();
        }
        return res;
    }

    private parseUnionType(type: ts.UnionType): Type {
        const union_type = new TSUnion();

        if (!type.types) {
            return builtinTypes.get('any')!;
        }

        for (const tstype of type.types) {
            union_type.addType(this.tsTypeToType(tstype));
        }

        const types = union_type.types;
        if (types.every((type) => type === types[0])) {
            return types[0];
        }

        // T | null will be treated as nullable T type
        if (types.find((type) => type.kind === TypeKind.NULL)) {
            const nonNullTypes = types.filter(
                (type) => type.kind !== TypeKind.NULL,
            );
            if (
                nonNullTypes.length > 0 &&
                nonNullTypes.every((type) => type === nonNullTypes[0]) &&
                !nonNullTypes[0].isPrimitive
            ) {
                return nonNullTypes[0];
            }
        }

        return union_type;
    }

    private parseEnumType(node: ts.EnumDeclaration): Type {
        const scope = this.currentScope!;

        let start = 0;
        const enumType = new TSEnum(node.name.getText());
        for (const member of node.members) {
            const name = member.name.getText();
            let value: number | string = start;
            if (member.initializer) {
                value = this.parseEnumMemberValue(enumType, member.initializer);
            } else {
                start++;
            }
            enumType.addMember(name, value);
        }
        scope.addType(node.name.getText(), enumType);
        return enumType;
    }

    private parseEnumMemberValue(
        enumType: TSEnum,
        expr: ts.Expression,
    ): number | string {
        switch (expr.kind) {
            case ts.SyntaxKind.StringLiteral:
                return (expr as ts.StringLiteral).text; // return the string value without \' or \"
            case ts.SyntaxKind.NumericLiteral:
                return parseInt((expr as ts.NumericLiteral).getText());
            case ts.SyntaxKind.Identifier: {
                const name = (expr as ts.Identifier).getText();
                const value = enumType.getMember(name);
                if (!value) {
                    throw new TypeError(`EnumMember cannot find ${name}`);
                }
                return value;
            }
            case ts.SyntaxKind.BinaryExpression: {
                const bnode = expr as ts.BinaryExpression;
                const left = this.parseEnumMemberValue(enumType, bnode.left);
                const right = this.parseEnumMemberValue(enumType, bnode.right);
                switch (bnode.operatorToken.kind) {
                    case ts.SyntaxKind.PlusToken:
                        if (typeof left == 'string' || typeof right == 'string')
                            return `${left}${right}`;
                        else return (left as number) + (right as number);
                    default:
                        throw new TypeError(
                            `EnumMember cannot support the operator ${
                                ts.SyntaxKind[bnode.operatorToken.kind]
                            }`,
                        );
                }
            }
            default:
                throw new TypeError(
                    `EnumMember don't support dynamic expression`,
                );
        }
    }

    private isObject(type: ts.Type): type is ts.ObjectType {
        return !!(type.flags & ts.TypeFlags.Object);
    }

    private isTypeReference(type: ts.Type): type is ts.TypeReference {
        return (
            this.isObject(type) &&
            !!(type.objectFlags & ts.ObjectFlags.Reference)
        );
    }

    private isInterface(type: ts.Type): type is ts.InterfaceType {
        return (
            this.isObject(type) &&
            !!(type.objectFlags & ts.ObjectFlags.Interface)
        );
    }

    private isObjectLiteral(type: ts.Type) {
        return this.isObject(type) && type.symbol.name === '__object';
    }

    // in most cases, the type has Anonymous ObjectTypeFlag
    private isObjectType(type: ts.Type) {
        return (
            this.isObject(type) &&
            type.symbol.name === '__type' &&
            !this.isFunction(type)
        );
    }

    private isArray(type: ts.Type): type is ts.TypeReference {
        return this.isTypeReference(type) && type.symbol.name === 'Array';
    }

    private isFunction(type: ts.Type): type is ts.ObjectType {
        if (this.isObject(type)) {
            return type.getCallSignatures().length > 0;
        }
        return false;
    }

    private parseObjectType(node: ts.Node, tsClass: TSClass) {
        const cached_type = this.nodeTypeCache.get(node);
        /** for TypeLiteral, it might be putted into cache before parsing */
        if (cached_type && this.parsedClassTypes.has(tsClass))
            return cached_type;
        tsClass.isLiteral = true;
        this.nodeTypeCache.set(node, tsClass);

        if (ts.isTypeAliasDeclaration(node.parent)) {
            this.typeParameterStack.push(tsClass);
            this.parseTypeParameters(tsClass, node.parent, this.currentScope);
        }
        const type = this.typechecker!.getTypeAtLocation(node);
        type.getProperties().map((prop) => {
            const propName = prop.name;
            const valueDecl = prop.valueDeclaration;
            if (!valueDecl) {
                throw new TypeError(
                    `property ${propName} has no declaration when parsing object type`,
                );
            }
            const propType = this.typechecker!.getTypeAtLocation(valueDecl);
            const tsType = this.tsTypeToType(propType);

            /* put all object literal's METHOD into vtable, FIELD into instance */
            if (
                tsType instanceof TSFunction &&
                ts.isMethodDeclaration(valueDecl)
            ) {
                this.setMethod(
                    valueDecl as ts.MethodDeclaration,
                    null,
                    tsClass,
                    FunctionKind.METHOD,
                );
            } else {
                tsClass.addMemberField({
                    name: propName,
                    type: tsType,
                    optional: (valueDecl as any).questionToken ? true : false,
                });
            }
        });

        this.parsedClassTypes.add(tsClass);
        return tsClass;
    }

    private parseSignature(signature: ts.Signature | undefined) {
        if (!signature) {
            throw new TypeError('signature is undefined');
        }
        const decl = signature.getDeclaration();
        const cached_type = this.nodeTypeCache.get(decl);
        if (cached_type) return cached_type as TSFunction;

        const tsFunction = new TSFunction();

        /* parse modifiers */
        tsFunction.isDeclare = signature.declaration
            ? this.parseNestDeclare(
                  <
                      | ts.FunctionLikeDeclaration
                      | ts.ModuleDeclaration
                      | ts.ClassDeclaration
                  >signature.declaration,
              )
            : false;

        tsFunction.isStatic = signature.declaration
            ? this.parseStatic(
                  <ts.FunctionLikeDeclaration>signature.declaration,
              )
            : false;

        tsFunction.isBinaryenImpl = !!signature.declaration?.modifiers?.find(
            (modifier) =>
                modifier.kind === ts.SyntaxKind.Decorator &&
                (<ts.Decorator>modifier).expression.getText() ===
                    BuiltinNames.decorator,
        );

        tsFunction.isExport = !!signature.declaration?.modifiers?.find(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        );

        tsFunction.isMethod =
            tsFunction.isMethod ||
            ts.isConstructorDeclaration(decl) ||
            ts.isMethodDeclaration(decl) ||
            ts.isConstructSignatureDeclaration(decl) ||
            ts.isMethodSignature(decl) ||
            ts.isAccessor(decl);

        /* parse original parameters type */
        this.typeParameterStack.push(tsFunction);
        // TODO check currentScope is right
        this.parseTypeParameters(
            tsFunction,
            signature.getDeclaration(),
            this.currentScope &&
                this.currentScope!.kind == ScopeKind.FunctionScope
                ? this.currentScope
                : null,
        );

        signature.getParameters().map((param, index) => {
            const valueDecl = param.valueDeclaration!;
            if (ts.isParameter(valueDecl) && valueDecl.dotDotDotToken) {
                /* restParamIdx should include the @context and @this */
                tsFunction.restParamIdx = index;
            }
            if (ts.isParameter(valueDecl) && valueDecl.questionToken) {
                tsFunction.addIsOptionalParam(true);
            } else {
                tsFunction.addIsOptionalParam(false);
            }
            let tsType = this.tsTypeToType(
                this.typechecker!.getTypeAtLocation(valueDecl),
            );
            // e.g.
            //  type ItemGenerator<T, U> = (item: T, index: U) => void
            //  function test_func<T, U>(func: ItemGenerator<U, T>, a: T, b: U) {...}
            if (
                tsType instanceof TSTypeWithArguments &&
                isTypeGeneric(tsType)
            ) {
                const param = valueDecl as ts.ParameterDeclaration;
                const typeArguments = this.typechecker!.getTypeAtLocation(
                    param.type!,
                ).aliasTypeArguments!.map((t) => {
                    return this.tsTypeToType(t);
                });
                tsType = TypeResolver.createSpecializedType(
                    tsType,
                    typeArguments,
                    tsType,
                );
            }

            /* builtin wasm types */
            const maybeWasmType = TypeResolver.maybeBuiltinWasmType(valueDecl);
            if (maybeWasmType) {
                tsType = maybeWasmType;
            }

            tsFunction.addParamType(tsType);
        });

        /* parse return type */
        const returnType =
            this.typechecker!.getReturnTypeOfSignature(signature);
        tsFunction.returnType = this.tsTypeToType(returnType);

        this.nodeTypeCache.set(decl, tsFunction);
        return tsFunction;
    }
    private parseNestDeclare(
        node:
            | ts.FunctionLikeDeclaration
            | ts.ModuleDeclaration
            | ts.ClassDeclaration
            | ts.InterfaceDeclaration,
    ): boolean {
        let res = false;
        if (node.modifiers) {
            const hasDeclareKeyword = node.modifiers.find((modifier) => {
                return modifier.kind === ts.SyntaxKind.DeclareKeyword;
            });
            if (hasDeclareKeyword) {
                return true;
            }
        }
        if (node.parent.kind === ts.SyntaxKind.ModuleBlock) {
            res = this.parseNestDeclare(
                <ts.ModuleDeclaration>node.parent.parent,
            );
        } else if (node.parent.kind === ts.SyntaxKind.ClassDeclaration) {
            res = this.parseNestDeclare(<ts.ModuleDeclaration>node.parent);
        }
        return res;
    }

    private parseIndexSignature(
        infc: TSInterface,
        indexSignature: ts.IndexSignatureDeclaration,
    ) {
        const param_type = indexSignature.parameters[0];
        const key_type = this.tsTypeToType(
            this.typechecker!.getTypeFromTypeNode(param_type.type!),
        );
        const value_type = this.tsTypeToType(
            this.typechecker!.getTypeFromTypeNode(indexSignature.type),
        );
        if (
            key_type.kind !== TypeKind.NUMBER &&
            key_type.kind !== TypeKind.STRING
        ) {
            throw new TypeError(
                `${infc.className} indexSignature need number or string : ${key_type}`,
            );
        }
        if (key_type.kind === TypeKind.NUMBER) {
            infc.setNumberIndexType(value_type);
        } else {
            infc.setStringIndexType(value_type);
        }
        Logger.debug(
            `=== ${infc.className} index type [${key_type}] : ${value_type}`,
        );
    }

    private parseInfcType(node: ts.InterfaceDeclaration, infc: TSInterface) {
        this.nodeTypeCache.set(node, infc);
        infc.setClassName(node.name!.getText());

        // if (node.typeParameters) {
        //     this.parseTypeParameterIndex(node.typeParameters, infc);
        // }
        this.parseTypeParameters(infc, node, this.currentScope);
        this.typeParameterStack.push(infc);
        infc.isDeclare = this.parseNestDeclare(node);

        const heritages = node.heritageClauses;
        const baseClassType: TSClass | null = null;
        let baseInfcType: TSInterface | null = null;
        const effectTypeArguments = new Array<TSTypeParameter>();
        /** if extends more than two classes, an error will be thrown,
         *  if extends a class, implements some interface, the subclass is subtype of supclass,
         *  but do not guarantee that it will be a subtype of the interface either.
         *  if implements more than one interface, the subclass is subtype of the first interface.
         */
        if (heritages) {
            const heritageTypes: TSClass[] = [];
            for (const h of heritages) {
                for (const type of h.types) {
                    const tsType = this.typechecker!.getTypeAtLocation(type);
                    const symbol = tsType.symbol;
                    if (!symbol) {
                        break;
                    }
                    const baseDecl = symbol.declarations![0];
                    const baseType = this.symbolTypeMap.get(baseDecl);
                    if (type.typeArguments) {
                        type.typeArguments.forEach((t) => {
                            effectTypeArguments.push(
                                this.generateNodeType(t) as TSTypeParameter,
                            );
                        });
                    }
                    if (!this.parsedClassTypes.has(baseType as TSClass)) {
                        if (baseType instanceof TSInterface) {
                            this.parseInfcType(
                                baseDecl as ts.InterfaceDeclaration,
                                baseType,
                            );
                        } else if (baseType instanceof TSClass) {
                            this.parseClassType(
                                baseDecl as ts.ClassDeclaration,
                                baseType,
                            );
                        }
                    }
                    heritageTypes.push(baseType as TSClass);
                }
            }
            for (const h of heritageTypes) {
                if (h instanceof TSInterface) {
                    if (baseInfcType) {
                        throw new TypeError(
                            `unimpl interface ${infc.className} extends more than one interface`,
                        );
                    }
                    if (!baseInfcType) {
                        baseInfcType = h;
                        infc.setBase(baseInfcType);
                    }
                } else {
                    // TODO：interface extends class. Don’t implement it now
                    throw new Error('unimpl interface extends class');
                }
            }
        }

        if (baseInfcType && isTypeGeneric(baseInfcType)) {
            const _infc = infc;
            const _effectTypeArguments = effectTypeArguments;

            // For the same interface base on different inheritance chains, we will regenerate a new base infc type.
            // The purpose is to prevent these base types from affecting each other.
            // e.g.
            //  interface IGeneric<X> {...};
            //  interface IGenericBase1<X, Y> extends IGeneric<Y> {...};
            //  interface IGenericBase2<X> extends IGeneric<X> {...};
            const newName = infc.className + '_' + baseInfcType.className;
            baseInfcType = TypeResolver.createSpecializedType(
                baseInfcType,
                _effectTypeArguments,
                baseInfcType,
                newName,
            ) as TSInterface;
            infc.setBase(baseInfcType);
            baseInfcType.setSpecializedArguments(_effectTypeArguments);
            baseInfcType.overrideOrOwnMethods.forEach((t) => {
                infc.overrideOrOwnMethods.add(t);
            });
            this.currentScope!.addType(newName, baseInfcType);
        }

        if (baseInfcType) {
            // TODO try resolve the template type
            for (const field of baseInfcType.fields) {
                infc.addMemberField(field);
            }
            for (const method of baseInfcType.memberFuncs) {
                infc.addMethod({
                    name: method.name,
                    type: method.type.clone(),
                    optional: method.optional,
                });
            }
        }

        for (let i = 0; i < node.members.length; ++i) {
            const member = node.members[i];
            if (member.kind == ts.SyntaxKind.IndexSignature) {
                this.parseIndexSignature(
                    infc,
                    member as ts.IndexSignatureDeclaration,
                );
                continue;
            }
            /** Currently, we only handle PropertySignature and MethodSignature */
            if (
                member.kind !== ts.SyntaxKind.ConstructSignature &&
                member.kind !== ts.SyntaxKind.PropertySignature &&
                member.kind !== ts.SyntaxKind.MethodSignature &&
                member.kind !== ts.SyntaxKind.CallSignature &&
                member.kind !== ts.SyntaxKind.GetAccessor &&
                member.kind !== ts.SyntaxKind.SetAccessor
            ) {
                continue;
            }
            let fieldType = this.generateNodeType(member);
            if (
                member.kind === ts.SyntaxKind.CallSignature &&
                node.members.length == 1
            ) {
                return fieldType;
            } else if (member.kind === ts.SyntaxKind.CallSignature) {
                continue;
            }
            let funcKind =
                member.kind == ts.SyntaxKind.ConstructSignature
                    ? FunctionKind.CONSTRUCTOR
                    : FunctionKind.METHOD;
            if (ts.isSetAccessor(member)) {
                const type = new TSFunction();
                type.addParamType(fieldType);
                fieldType = type;
                funcKind = FunctionKind.SETTER;
                this.parseTypeParameters(
                    type,
                    member as ts.DeclarationWithTypeParameters,
                    null,
                );
            }
            if (ts.isGetAccessor(member)) {
                const type = new TSFunction(FunctionKind.GETTER);
                type.returnType = fieldType;
                fieldType = type;
                funcKind = FunctionKind.GETTER;
                this.parseTypeParameters(
                    type,
                    member as ts.DeclarationWithTypeParameters,
                    null,
                );
            }
            const fieldName =
                funcKind == FunctionKind.CONSTRUCTOR
                    ? 'constructor'
                    : member.name!.getText();
            if (fieldType instanceof TSUnion && member.questionToken) {
                const type = fieldType.types.find((type) => {
                    return type instanceof TSFunction;
                });
                if (type) {
                    fieldType = type;
                }
            }
            if (fieldType instanceof TSFunction) {
                fieldType.funcKind = funcKind;
                infc.addMethod({
                    name: fieldName,
                    type: fieldType,
                    optional: member.questionToken ? true : false,
                });
                this.parseTypeParameters(
                    fieldType as TSFunction,
                    member as ts.DeclarationWithTypeParameters,
                    null,
                );
                infc.overrideOrOwnMethods.add(fieldName);
            } else {
                infc.addMemberField({
                    name: fieldName,
                    type: fieldType,
                    optional: member.questionToken ? true : false,
                });
            }
        }
        this.parsedClassTypes.add(infc);
        return infc;
    }

    private parseClassType(node: ts.ClassDeclaration, classType: TSClass) {
        this.nodeTypeCache.set(node, classType);
        classType.setClassName(node.name!.getText());

        const scope = this.parserCtx.nodeScopeMap.get(node)!;
        this.parseTypeParameters(classType, node, scope);
        this.typeParameterStack.push(classType);

        classType.isDeclare = this.parseNestDeclare(node);

        const heritages = node.heritageClauses;
        let baseClassType: TSClass | null = null;
        let baseInfcType: TSInterface | null = null;
        const effectTypeArguments = new Array<TSTypeParameter>();
        /** if extends more than two classes, an error will be thrown,
         *  if extends a class, implements some interface, the subclass is subtype of supclass,
         *  but do not guarantee that it will be a subtype of the interface either.
         *  if implements more than one interface, the subclass is subtype of the first interface.
         */
        if (heritages) {
            const heritageTypes: TSClass[] = [];
            for (const h of heritages) {
                for (const type of h.types) {
                    const baseTsType = this.typechecker!.getTypeAtLocation(
                        type.expression,
                    );
                    const symbol = baseTsType.symbol;
                    const baseDecl = symbol.declarations![0];
                    const baseType = this.symbolTypeMap.get(baseDecl);
                    if (type.typeArguments) {
                        type.typeArguments.forEach((t) => {
                            effectTypeArguments.push(
                                this.generateNodeType(t) as TSTypeParameter,
                            );
                        });
                    }
                    if (!this.parsedClassTypes.has(baseType as TSClass)) {
                        if (baseType instanceof TSInterface) {
                            this.parseInfcType(
                                baseDecl as ts.InterfaceDeclaration,
                                baseType,
                            );
                        } else if (baseType instanceof TSClass) {
                            this.parseClassType(
                                baseDecl as ts.ClassDeclaration,
                                baseType,
                            );
                        }
                    }
                    heritageTypes.push(baseType as TSClass);
                }
            }
            for (const h of heritageTypes) {
                if (h instanceof TSInterface) {
                    if (!baseClassType && !baseInfcType) {
                        baseInfcType = h;
                        classType.setImplInfc(baseInfcType);
                    }
                } else {
                    if (baseInfcType) {
                        baseInfcType = null;
                        classType.setImplInfc(baseInfcType);
                    }
                    if (baseClassType) {
                        throw new TypeError('unimpl multiple base classes');
                    }
                    baseClassType = h;
                    classType.setBase(baseClassType);
                }
            }
        }

        if (baseInfcType && isTypeGeneric(baseInfcType)) {
            const _effectTypeArguments = effectTypeArguments;
            const newName = classType.className + '_' + baseInfcType.className;
            baseInfcType = TypeResolver.createSpecializedType(
                baseInfcType,
                _effectTypeArguments,
                baseInfcType,
                newName,
            ) as TSInterface;
            baseInfcType.setSpecializedArguments(_effectTypeArguments);
            classType.setImplInfc(baseInfcType);
            let _baseInfcType: TSClass | null = baseInfcType;
            while (_baseInfcType) {
                this.currentScope!.parent!.addType(
                    _baseInfcType.className,
                    _baseInfcType,
                );
                _baseInfcType = _baseInfcType.getBase();
            }
        }

        // handling type parameters in the inheritance chain
        /* e.g.
         *  class Generic<X> {...};
         *  class GenericBase<X, Y> extends Generic<Y> {...};
         */
        // On the inheritance chain, the type parameter of Generic is Y,
        // and in its class definition, the type parameter is X.
        // So it needs to be corrected based on the actual type parameters on the inheritance chain.
        if (baseClassType && isTypeGeneric(baseClassType)) {
            const _classType = classType;
            const _effectTypeArguments = effectTypeArguments;

            // For the same class base on different inheritance chains, we will regenerate a new base class type.
            // The purpose is to prevent these base types from affecting each other.
            // e.g.
            //  class Generic<X> {...};
            //  class GenericBase1<X, Y> extends Generic<Y> {...};
            //  class GenericBase2<X> extends Generic<X> {...};
            const newName = classType.className + '_' + baseClassType.className;
            baseClassType = TypeResolver.createSpecializedType(
                baseClassType,
                _effectTypeArguments,
                baseClassType,
                newName,
            ) as TSClass;
            baseClassType.setSpecializedArguments(_effectTypeArguments);
            classType.setBase(baseClassType);
        }

        if (baseClassType) {
            // TODO try resolve the template type
            for (const field of baseClassType.fields) {
                classType.addMemberField(field);
            }
            for (const pair of baseClassType.staticFieldsInitValueMap) {
                classType.staticFieldsInitValueMap.set(pair[0], pair[1]);
            }
            for (const staticField of baseClassType.staticFields) {
                classType.addStaticMemberField(staticField);
            }
            for (const method of baseClassType.memberFuncs) {
                classType.addMethod({
                    name: method.name,
                    type: method.type.clone(),
                    optional: method.optional,
                });
            }
        }

        // 1. parse constructor
        let ctorScope: FunctionScope;
        const constructor = node.members.find((member) => {
            return ts.isConstructorDeclaration(member);
        });
        if (constructor) {
            ctorScope = this.nodeScopeMap.get(constructor)! as FunctionScope;
        } else {
            const classScope = this.nodeScopeMap.get(node)! as ClassScope;
            ctorScope = new FunctionScope(classScope);
            ctorScope.setFuncName('constructor');
            ctorScope.setClassName(node.name!.getText());
            ctorScope.addVariable(new Variable('this', classType));

            const ctorType = new TSFunction(FunctionKind.CONSTRUCTOR);
            ctorType.belongedClass = classType;
            ctorType.setBelongedScope(ctorScope);
            ctorType.returnType = classType;
            ctorType.isMethod = true;
            classType.hasDeclareCtor = false;
            ctorScope.setFuncType(ctorType);
            classType.ctorType = ctorType;

            if (baseClassType) {
                const baseCtorType = baseClassType.ctorType;
                const paramTypes = baseCtorType.getParamTypes();
                for (let i = 0; i < paramTypes.length; i++) {
                    const paramType = paramTypes[i];
                    const newType = TypeResolver.createSpecializedType(
                        paramType,
                        effectTypeArguments,
                        classType,
                    );
                    if (!newType)
                        throw new TypeError('unimpl TSTypeParameter exchange');

                    if (newType instanceof TSTypeWithArguments)
                        newType.setSpecializedArguments(effectTypeArguments);

                    ctorType.addParamType(paramTypes[i]);
                    ctorScope.addParameter(
                        new Parameter(`@anonymous${i}`, paramTypes[i]),
                    );
                }
            }
        }

        // 2. parse other fields
        for (const member of node.members) {
            if (ts.isSemicolonClassElement(member)) {
                /* ES6 allows Semicolon as class elements, we just skip them */
                continue;
            }
            const name = ts.isConstructorDeclaration(member)
                ? 'constructor'
                : member.name!.getText();

            if (ts.isPropertyDeclaration(member)) {
                const type = this.generateNodeType(member);
                const modifier = member.modifiers?.find((m) => {
                    return m.kind === ts.SyntaxKind.ReadonlyKeyword;
                })
                    ? 'readonly'
                    : undefined;
                const staticModifier = member.modifiers?.find((m) => {
                    return m.kind === ts.SyntaxKind.StaticKeyword;
                })
                    ? 'static'
                    : undefined;
                const classField: TsClassField = {
                    name: name,
                    type: type,
                    modifier: modifier,
                    visibility: 'public',
                    static: staticModifier,
                    optional: member.questionToken ? true : false,
                };
                if (member.initializer) {
                    if (classField.static) {
                        let index = classType.getStaticFieldIndex(name);
                        if (index === -1) {
                            index = classType.staticFields.length;
                        }
                        classType.staticFieldsInitValueMap.set(
                            index,
                            this.parserCtx.expressionProcessor.visitNode(
                                member.initializer,
                            ),
                        );
                    } else {
                        ctorScope.addStatement(
                            this.parserCtx.statementProcessor.createFieldAssignStmt(
                                member.initializer,
                                classType,
                                type,
                                name,
                            ),
                        );
                    }
                }

                if (!classField.static) {
                    const found = classType.getMemberField(name);
                    if (found) continue;
                    classType.addMemberField(classField);
                } else {
                    const found = classType.getStaticMemberField(name);
                    if (found) continue;
                    classType.addStaticMemberField(classField);
                }
            }
            if (ts.isSetAccessor(member)) {
                this.setMethod(
                    member,
                    baseClassType,
                    classType,
                    FunctionKind.SETTER,
                );
            }
            if (ts.isGetAccessor(member)) {
                this.setMethod(
                    member,
                    baseClassType,
                    classType,
                    FunctionKind.GETTER,
                );
            }
            if (ts.isMethodDeclaration(member)) {
                const kind = member.modifiers?.find((m) => {
                    return m.kind === ts.SyntaxKind.StaticKeyword;
                })
                    ? FunctionKind.STATIC
                    : FunctionKind.METHOD;
                this.setMethod(member, baseClassType, classType, kind);
            }
            if (ts.isConstructorDeclaration(member)) {
                const ctorType = this.parseConstructor(member);
                ctorScope.setFuncType(ctorType);
                classType.ctorType = ctorType;
                ctorType.belongedClass = classType;
            }
        }

        /** Reset baseInfcType if the base interface contains optional properties, which the class doesn't have */
        if (baseInfcType) {
            for (const field of baseInfcType.fields) {
                if (field.optional) {
                    const found = classType.getMemberField(field.name);
                    if (!found || !found.optional) {
                        baseInfcType = null;
                        classType.setImplInfc(baseInfcType);
                        break;
                    }
                }
            }
            if (baseInfcType) {
                for (const method of baseInfcType.memberFuncs) {
                    if (method.optional) {
                        const found = classType.getMethod(
                            method.name,
                            method.type.funcKind,
                        );
                        if (found.index === -1 || found.method!.optional) {
                            baseInfcType = null;
                            classType.setImplInfc(baseInfcType);
                            break;
                        }
                    }
                }
            }
        }
        /** reorder member orders for optimization */
        if (baseInfcType) {
            const baseFields = baseInfcType.fields;
            for (let i = baseFields.length - 1; i >= 0; i--) {
                const index = classType.fields.findIndex(
                    (field) => field.name == baseFields[i].name,
                );
                if (index > -1) {
                    const targetField = classType.fields[index];
                    classType.fields.splice(index, 1);
                    classType.fields.unshift(targetField);
                }
            }
            const baseMethods = baseInfcType.memberFuncs;
            for (let i = baseMethods.length - 1; i >= 0; i--) {
                const index = classType.getMethod(
                    baseMethods[i].name,
                    baseMethods[i].type.funcKind,
                ).index;
                if (index > -1) {
                    const targetMethod = classType.memberFuncs[index];
                    classType.memberFuncs.splice(index, 1);
                    classType.memberFuncs.unshift(targetMethod);
                }
            }
        }

        this.parsedClassTypes.add(classType);
        return classType;
    }

    private setMethod(
        decl:
            | ts.AccessorDeclaration
            | ts.MethodDeclaration
            | ts.PropertyAssignment,
        baseClassType: TSClass | null,
        classType: TSClass,
        funcKind: FunctionKind,
    ) {
        const methodName = decl.name.getText();
        let func:
            | ts.AccessorDeclaration
            | ts.MethodDeclaration
            | ts.FunctionExpression;
        if (ts.isPropertyAssignment(decl)) {
            func = decl.initializer as ts.FunctionExpression;
        } else {
            func = decl;
        }
        const type = this.generateNodeType(func);
        let tsFuncType = new TSFunction(funcKind);

        const scope = this.parserCtx.nodeScopeMap.get(func)!;
        this.parseTypeParameters(tsFuncType, func, scope);

        const nameWithPrefix = getMethodPrefix(funcKind) + decl.name.getText();

        if (type instanceof TSFunction) {
            type.funcKind = tsFuncType.funcKind;
            tsFuncType = type;
        }
        if (funcKind === FunctionKind.GETTER) {
            tsFuncType.returnType = type;
        }
        if (funcKind === FunctionKind.SETTER) {
            tsFuncType.addParamType(type);
        }

        let isOverride = false;
        if (baseClassType) {
            const baseFuncType = baseClassType.getMethod(methodName, funcKind)
                .method?.type;
            if (baseFuncType) {
                if (!tsFuncType.belongedClass)
                    tsFuncType.belongedClass = classType;
                // override the method of base class
                classType.updateMethod(methodName, funcKind, tsFuncType);
                isOverride = true;
            }
        }
        if (!isOverride) {
            /* override methods has been copied from base class,
                only add non-override methods here */
            classType.addMethod({
                name: methodName,
                type: tsFuncType,
                optional: func.questionToken ? true : false,
            });
        }

        const funcDef = this.parserCtx.getScopeByNode(func);
        if (funcDef && funcDef instanceof FunctionScope) {
            funcDef.setFuncType(tsFuncType);
            tsFuncType.setBelongedScope(funcDef);
        }
        classType.overrideOrOwnMethods.add(nameWithPrefix);
    }

    parseTypeParameters(
        tstype: TSTypeWithArguments,
        node: ts.DeclarationWithTypeParameters,
        scope: Scope | null,
    ) {
        const typeParams = ts.getEffectiveTypeParameterDeclarations(node);
        if (!typeParams) return;

        let index = 0;
        for (const tp of typeParams!) {
            const name = tp.name.getText();
            const constraint_node =
                ts.getEffectiveConstraintOfTypeParameter(tp);
            let wide_type: Type = builtinTypes.get('generic')!;
            if (constraint_node) {
                // TypeNode
                const constraint_tstype =
                    this.typechecker!.getTypeFromTypeNode(constraint_node);
                wide_type = this.tsTypeToType(constraint_tstype);
            }
            let default_type: Type | undefined = undefined;
            const default_node = tp.default;
            if (default_node) {
                const default_tstype =
                    this.typechecker!.getTypeFromTypeNode(default_node);
                default_type = this.tsTypeToType(default_tstype);
            }

            const type_param = new TSTypeParameter(
                name,
                wide_type,
                index++,
                default_type,
            );

            tstype.addTypeParameter(type_param);

            if (scope) {
                scope.addType(type_param.name, type_param);
            }
        }
    }

    private parseStatic(node: ts.FunctionLikeDeclaration): boolean {
        let res = false;
        if (node.modifiers) {
            const hasStaticKeyword = node.modifiers.find((modifier) => {
                return modifier.kind === ts.SyntaxKind.StaticKeyword;
            });
            if (hasStaticKeyword) {
                res = true;
            }
        }
        return res;
    }

    private parseConstructor(ctor: ts.ConstructorDeclaration) {
        const signature = this.typechecker!.getSignatureFromDeclaration(ctor);
        const tsFunction = this.parseSignature(signature);
        tsFunction.funcKind = FunctionKind.CONSTRUCTOR;
        return tsFunction;
    }

    private parseTypeRefRelationship(type: TSClass) {
        if (!this.typeRefsMap.has(type)) {
            this.typeRefsMap.set(type, new Set<TSClass>());
        }
        const refs = this.typeRefsMap.get(type)!;
        type.fields.map((field) => {
            if (!field.static) {
                this.parseTypeRefRelationship2(field.type, refs);
            }
        });
        type.memberFuncs.map((method) => {
            if (!method.type.isStatic) {
                this.parseTypeRefRelationship2(method.type, refs);
            }
        });
    }

    private parseTypeRefRelationship2(type: Type, refsSet: Set<TSClass>) {
        if (type instanceof TSClass) {
            refsSet.add(type);
            return;
        }
        if (type instanceof TSArray) {
            this.parseTypeRefRelationship2(type.elementType, refsSet);
        }
        if (type instanceof TSFunction) {
            this.parseTypeRefRelationship2(type.returnType, refsSet);
            for (const param of type.getParamTypes()) {
                this.parseTypeRefRelationship2(param, refsSet);
            }
        }
    }

    private typeIdAllocate(type: TSClass) {
        if (type.traverseStatus === TraverseStatus.PROCESSED) {
            return;
        }
        // meet a circular reference
        if (type.traverseStatus === TraverseStatus.VISITTED) {
            type.traverseStatus = TraverseStatus.PROCESSED;
            type.typeId = this.parserCtx.typeId;
            if (type.className === '') {
                type.setClassName(`@object_type${type.typeId}`);
            }
            this.parserCtx.typeId += 2;
            this.loopEntry = type;
            this.parserCtx.recGroupTypes.push(new Array<TSClass>());
            return;
        }

        type.traverseStatus = TraverseStatus.VISITTED;
        const refArray = this.typeRefsMap.get(type);
        if (refArray && refArray.size > 0) {
            refArray.forEach((ref) => {
                this.typeIdAllocate(ref);
            });
        }
        if (type.traverseStatus === TraverseStatus.VISITTED) {
            const shapeStr = this.getShapeDesc(type);
            type.typeId = this.generateTypeId(shapeStr);
            if (type.className === '') {
                type.setClassName(`@object_type${type.typeId}`);
            }
            type.traverseStatus = TraverseStatus.PROCESSED;
        }

        if (this.loopEntry) {
            const len = this.parserCtx.recGroupTypes.length;
            this.parserCtx.recGroupTypes[len - 1].push(type);
            if (type === this.loopEntry) {
                this.loopEntry = null;
            }
        }
    }

    private generateTypeId(typeString: string): number {
        if (this.parserCtx.typeIdMap.has(typeString)) {
            return this.parserCtx.typeIdMap.get(typeString)!;
        }
        const id = this.parserCtx.typeId;
        this.parserCtx.typeId += 2; // next typeid
        this.parserCtx.typeIdMap.set(typeString, id);
        return id;
    }

    private getShapeDesc(tsClass: TSClass) {
        let str = '';
        tsClass.fields.map((field) => {
            str =
                str +
                field.name +
                (field.optional ? '?: ' : ': ') +
                this.getTypeString(field.type) +
                ',';
        });
        tsClass.memberFuncs
            .filter((func) => {
                return func.type.funcKind !== FunctionKind.STATIC;
            })
            .map(
                (func) =>
                    (str =
                        str +
                        func.name +
                        (func.optional ? '?: ' : ': ') +
                        this.getTypeString(func.type) +
                        '(m)' +
                        ','),
            );
        /* We add a (m) suffix to indicate this is a method rather than a field of function type */

        return str;
    }

    private noTypeParmeters(type: readonly ts.Type[]) {
        return (
            type.length > 0 &&
            type.every((t) => {
                return !(t.flags & ts.TypeFlags.TypeParameter);
            })
        );
    }

    private getTypeString(type: Type): string {
        if (type instanceof Primitive) {
            return type.toString();
        } else if (type instanceof TSUnion) {
            return type._types.join('|');
        } else if (type instanceof TSArray) {
            return this.getTypeString(type.elementType) + '[]';
        } else if (type instanceof TSClass) {
            return type.typeId.toString();
        } else if (type instanceof WasmType) {
            return type.getName();
        } else if (type instanceof TSFunction) {
            let res = '(';
            const len = type.getParamTypes().length;
            const paramTypes: string[] = new Array<string>(len);
            for (let i = 0; i < len - 1; i++) {
                paramTypes[i] = this.getTypeString(type.getParamTypes()[i]);
                if (type.isOptionalParams[i]) {
                    paramTypes[i] = '?' + paramTypes[i];
                }
            }
            if (type.hasRest()) {
                paramTypes[len - 1] =
                    '...' + this.getTypeString(type.getParamTypes()[len - 1]);
            }
            res = res + paramTypes.join(',') + ')';
            res = res + '=>' + this.getTypeString(type.returnType);
            return res;
        } else {
            // types unimplemented
            Logger.info(`types unimplemented ${type.kind}`);
            return 'unknown';
        }
    }

    public static maybeBuiltinWasmType(node: ts.Node) {
        const definedTypeName = (node as any).type?.typeName?.escapedText;
        if (definedTypeName) {
            if (builtinWasmTypes.has(definedTypeName)) {
                return builtinWasmTypes.get(definedTypeName)!;
            }
        }
    }

    public static createSpecializedType(
        type: Type,
        specializedArgs: Type[],
        containType: TSTypeWithArguments,
        newName?: string,
    ): Type {
        // the type that need to be specialized must be generic
        if (!isTypeGeneric(type)) return type;

        // SpecializedArgs MAY contain generic type.
        // This situation currently occurs in the generic inheritance chain.
        // e.g.
        //  class Generic<X> {...};
        //  class GenericBase<X, Y> extends Generic<Y> {...};
        //
        //  At this time, we need to change the type parameter of the generic Generic on the inheritance chain from X to Y.
        let genericInheritance = false;
        specializedArgs.forEach((t) => {
            if (isTypeGeneric(t)) {
                genericInheritance = true;
            }
        });

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
                return type;
            }
            case TypeKind.ARRAY: {
                return new TSArray(
                    this.createSpecializedType(
                        (type as TSArray).elementType,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    ),
                );
            }
            case TypeKind.UNION: {
                const unionType = type as TSUnion;
                const newUnion = new TSUnion();
                unionType.types.forEach((t) => {
                    if (t.kind == TypeKind.UNDEFINED) {
                        newUnion.addType(t);
                    } else {
                        const newType = this.createSpecializedType(
                            t,
                            specializedArgs,
                            containType as TSTypeWithArguments,
                        );
                        newUnion.addType(newType);
                    }
                });
                return newUnion;
            }
            case TypeKind.FUNCTION: {
                const funcType = type as TSFunction;
                const newFuncType = funcType.clone();
                // specialized function does not have '_typeArguments' property
                if (!genericInheritance)
                    newFuncType.setTypeParameters(undefined);

                // regenerate the parameter list
                newFuncType.setParamTypes([]);
                funcType.getParamTypes().forEach((paramType) => {
                    const newParamType = this.createSpecializedType(
                        paramType,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    );
                    if (newParamType instanceof TSTypeWithArguments)
                        newParamType.setSpecializedArguments(specializedArgs);
                    newFuncType.addParamType(newParamType);
                });

                // prevent infinite recursive call
                if (
                    funcType.isMethod &&
                    funcType.returnType instanceof TSClass &&
                    funcType.returnType.typeId == funcType.belongedClass?.typeId
                )
                    return newFuncType;

                newFuncType.returnType = this.createSpecializedType(
                    funcType.returnType,
                    specializedArgs,
                    containType as TSTypeWithArguments,
                );
                if (newFuncType.returnType instanceof TSTypeWithArguments)
                    newFuncType.returnType.setSpecializedArguments(
                        specializedArgs,
                    );
                return newFuncType;
            }
            case TypeKind.CLASS:
            case TypeKind.INTERFACE: {
                const classType = type as TSClass;
                let newType: TSClass;
                if (type.kind === TypeKind.CLASS) {
                    newType = new TSClass();
                } else {
                    newType = new TSInterface();
                }

                // generate the class name of the new class
                const typeNames = new Array<string>();
                specializedArgs.forEach((v) => {
                    typeNames.push(`${v.kind}`);
                });
                if (genericInheritance) {
                    // e.g.
                    // In this generic inheritance chain case: class GenericBase<X, Y> extends Generic<Y> {...}
                    // The name of the new generic class will be changed from a to Generic to Generic_GenericBase
                    const specializedName = newName
                        ? newName
                        : classType.className;
                    newType.setClassName(specializedName);
                    specializedArgs.forEach((v) => {
                        newType.addTypeParameter(v as TSTypeParameter);
                    });
                } else {
                    // e.g.
                    // Generic<X> -> Generic<string>
                    const specializedName =
                        classType.className + '<' + typeNames.join(',') + '>';
                    newType.setClassName(specializedName);
                    newType.setGenericOwner(classType);
                }

                // set the property value of the basic property
                if (classType.getBase()) {
                    const base = classType.getBase()!;
                    const base_typeArguments = base!.typeArguments;

                    /*
                     * Calculate the specialization parameter list of the base class
                     * based on the specialization parameter list and type parameter list of the inherited class
                     */
                    if (base_typeArguments) {
                        const baseSpecializedArgs = new Array<Type>();
                        if (specializedArgs) {
                            for (
                                let i = 0;
                                i < base_typeArguments.length;
                                i++
                            ) {
                                const genericType = base_typeArguments[
                                    i
                                ] as TSTypeParameter;
                                const type = TypeResolver.createSpecializedType(
                                    genericType,
                                    specializedArgs,
                                    classType,
                                );
                                if (type instanceof TSTypeWithArguments)
                                    type.setSpecializedArguments(
                                        specializedArgs,
                                    );
                                baseSpecializedArgs.push(type);
                            }
                        }
                        const newName =
                            newType.className +
                            '_' +
                            base!.className.split('_').reverse()[0];
                        const newBaseType = TypeResolver.createSpecializedType(
                            base!,
                            baseSpecializedArgs,
                            base!,
                            newName,
                        ) as TSClass;
                        newBaseType.setSpecializedArguments(
                            baseSpecializedArgs,
                        );
                        newType.setBase(newBaseType);
                    } else {
                        newType.setBase(base!);
                    }
                }

                newType.hasDeclareCtor = classType.hasDeclareCtor;
                const implInfc = classType.getImplInfc();
                if (implInfc && isTypeGeneric(implInfc)) {
                    const infc_typeArguments = implInfc.typeArguments;
                    if (infc_typeArguments) {
                        const infcSpecializedArgs = new Array<Type>();
                        if (specializedArgs) {
                            for (
                                let i = 0;
                                i < infc_typeArguments.length;
                                i++
                            ) {
                                const genericType = infc_typeArguments[
                                    i
                                ] as TSTypeParameter;
                                const type = TypeResolver.createSpecializedType(
                                    genericType,
                                    specializedArgs,
                                    classType,
                                );
                                if (type instanceof TSTypeWithArguments)
                                    type.setSpecializedArguments(
                                        specializedArgs,
                                    );
                                infcSpecializedArgs.push(type);
                            }
                        }
                        const infc = TypeResolver.createSpecializedType(
                            implInfc,
                            infcSpecializedArgs,
                            implInfc,
                        ) as TSInterface;
                        infc.setSpecializedArguments(infcSpecializedArgs);
                        newType.setImplInfc(infc);
                    }
                } else {
                    newType.setImplInfc(implInfc);
                }
                newType.isDeclare = classType.isDeclare;
                newType.isLiteral = classType.isLiteral;
                newType.overrideOrOwnMethods = classType.overrideOrOwnMethods;
                newType.traverseStatus = classType.traverseStatus;

                // specialized member variables
                classType.fields.forEach((field) => {
                    const newFieldType = this.createSpecializedType(
                        field.type,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    );
                    if (newFieldType instanceof TSTypeWithArguments)
                        newFieldType.setSpecializedArguments(specializedArgs);
                    newType.addMemberField({
                        name: field.name,
                        type: newFieldType,
                    });
                });
                // specialized member functions
                classType.memberFuncs.forEach((func) => {
                    const newFuncType = this.createSpecializedType(
                        func.type,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    ) as TSFunction;
                    newFuncType.setSpecializedArguments(specializedArgs);
                    newType.addMethod({
                        name: func.name,
                        type: newFuncType,
                    });
                });
                classType.staticFields.forEach((field) => {
                    const newStaticFieldType = this.createSpecializedType(
                        field.type,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    );
                    if (newStaticFieldType instanceof TSTypeWithArguments)
                        newStaticFieldType.setSpecializedArguments(
                            specializedArgs,
                        );
                    newType.addStaticMemberField({
                        name: field.name,
                        type: newStaticFieldType,
                    });
                });
                // specialized constructor
                if (classType.ctorType) {
                    newType.ctorType = this.createSpecializedType(
                        classType.ctorType,
                        specializedArgs,
                        containType as TSTypeWithArguments,
                    ) as TSFunction;
                    newType.ctorType.setSpecializedArguments(specializedArgs);
                    newType.ctorType.returnType = newType;
                }

                // create the classScope to which the new class type belongs, but it doesn't always exist
                const originalClassScope = classType.belongedScope;
                if (!originalClassScope) return newType;
                originalClassScope.parent?.addType(newType.className, newType);
                const newClassScope = createClassScopeByClassType(
                    originalClassScope as ClassScope,
                    originalClassScope.parent!,
                    newType,
                );
                newType.setBelongedScope(newClassScope);
                return newType;
            }
            case TypeKind.TYPE_PARAMETER: {
                const genericType = type as TSTypeParameter;
                const typeArgs = containType.typeArguments;
                if (specializedArgs && typeArgs) {
                    for (let i = 0; i < typeArgs.length; i++) {
                        if (typeArgs[i].name === genericType.name) {
                            return specializedArgs[i];
                        }
                    }
                }

                return builtinTypes.get('any')!;
            }
            default: {
                throw new UnimplementError('Not implemented type: ${type}');
            }
        }
    }

    public arrayTypeCheck(node: ts.Node): boolean {
        const parentNode = node.parent;
        if (
            ts.isVariableDeclaration(parentNode) ||
            (ts.isBinaryExpression(parentNode) &&
                parentNode.operatorToken.kind === ts.SyntaxKind.EqualsToken)
        ) {
            const type = this.typechecker!.getTypeAtLocation(parentNode);
            if (this.isArray(type) && type.typeArguments) {
                return true;
            }
        }
        return false;
    }
}

export class CustomTypeResolver {
    globalScopes: Array<GlobalScope>;

    constructor(private parserCtx: ParserContext) {
        this.globalScopes = this.parserCtx.globalScopes;
    }

    visit() {
        for (const globalScope of this.globalScopes) {
            globalScope.traverseScopTree((scope) => {
                if (
                    scope instanceof FunctionScope ||
                    scope instanceof GlobalScope
                ) {
                    /* Assign index for function variables */
                    scope.initVariableIndex();
                    scope.initParamIndex();
                }
            });
            this.parseThis(globalScope);
            this.parseContext(globalScope);
        }
    }

    private parseThis(scope: Scope) {
        if (
            scope instanceof FunctionScope &&
            scope.parent instanceof ClassScope &&
            scope.isMethod() &&
            !scope.isStatic()
        ) {
            const thisType: Type = scope.parent.classType;
            for (const variable of scope.varArray) {
                if (variable.varName === 'this') {
                    variable.varType = thisType;
                    break;
                }
            }
        }

        /* traverse scope's children */
        for (const child of scope.children) {
            this.parseThis(child);
        }
    }

    private parseContext(scope: Scope) {
        if (scope instanceof ClosureEnvironment) {
            const currentCtxVar = scope.contextVariable!;
            let parentScope = scope.parent;
            let parentCtxVar: Variable | undefined = undefined;
            // skip class scope
            while (
                parentScope instanceof ClassScope ||
                parentScope instanceof NamespaceScope
            ) {
                parentScope = parentScope.parent;
            }
            if (scope instanceof FunctionScope) {
                /* function scope: parse param context type and variable context type */
                if (parentScope instanceof GlobalScope) {
                    parentCtxVar = undefined;
                } else if (parentScope instanceof ClosureEnvironment) {
                    parentCtxVar = parentScope.contextVariable!;
                }
                this.parseParamContextType(scope, parentCtxVar);
                const realParamCtxVar = new Parameter(
                    '@context',
                    scope.realParamCtxType,
                    [],
                    0,
                );
                this.parseVarContextType(
                    scope,
                    currentCtxVar,
                    realParamCtxVar.varType as TSContext,
                    realParamCtxVar,
                );
            } else if (
                scope instanceof BlockScope &&
                scope.parent?.getNearestFunctionScope()
            ) {
                /* block scope: parse variable context type */
                if (parentScope instanceof GlobalScope) {
                    parentCtxVar = undefined;
                } else if (parentScope instanceof ClosureEnvironment) {
                    parentCtxVar = parentScope.contextVariable;
                }
                this.parseVarContextType(
                    scope,
                    currentCtxVar,
                    parentCtxVar
                        ? (parentCtxVar.varType as TSContext)
                        : new TSContext(),
                    parentCtxVar,
                );
            }
        }

        /* traverse scope's children */
        for (const child of scope.children) {
            this.parseContext(child);
        }
    }

    private parseParamContextType(
        scope: FunctionScope,
        parentVarContextVar?: Variable,
    ) {
        let paramContextType = new TSContext();
        if (parentVarContextVar) {
            paramContextType = new TSContext(
                parentVarContextVar!.varType as TSContext,
            );
        }
        /* record the realType */
        scope.realParamCtxType = paramContextType;
        scope.addType(paramContextType.toString(), paramContextType);
    }

    private parseVarContextType(
        scope: ClosureEnvironment,
        currentCtxVar: Variable,
        parentContextType: TSContext,
        parentCtxVar?: Variable,
    ) {
        if (parentCtxVar) {
            currentCtxVar.initContext = parentCtxVar;
        }
        const varFreeVarTypeList: Type[] = [];
        if (scope instanceof FunctionScope) {
            scope.paramArray.forEach((value) => {
                if (value.varIsClosure) {
                    value.belongCtx = currentCtxVar;
                    value.closureIndex = varFreeVarTypeList.length;
                    varFreeVarTypeList.push(value.varType);
                }
            });
        }
        scope.varArray.forEach((value) => {
            if (value.varIsClosure) {
                value.belongCtx = currentCtxVar;
                value.closureIndex = varFreeVarTypeList.length;
                varFreeVarTypeList.push(value.varType);
            }
        });
        const varContextType = new TSContext(
            parentContextType,
            varFreeVarTypeList,
        );
        currentCtxVar.varType = varContextType;
        scope.addType(varContextType.toString(), varContextType);
        return varContextType;
    }
}
