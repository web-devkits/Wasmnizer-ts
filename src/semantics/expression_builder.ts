/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';
import {
    ValueType,
    ValueTypeKind,
    PrimitiveType,
    Primitive,
    ArrayType,
    SetType,
    MapType,
    UnionType,
    TypeParameterType,
    FunctionType,
    ClosureContextType,
    EnumType,
    ObjectType,
    ValueTypeWithArguments,
} from './value_types.js';
import { PredefinedTypeId, getNodeLoc, isTypeGeneric } from '../utils.js';
import { Logger } from '../log.js';

import {
    createType,
    isObjectType,
    isNullValueType,
    createUnionType,
    createArrayType,
    createObjectType,
    SpecializeTypeMapper,
    CreateWideTypeFromTypes,
} from './type_creator.js';

import { GetPredefinedType } from './predefined_types.js';

import { DumpWriter, CreateDefaultDumpWriter } from './dump.js';

import {
    SemanticsValueKind,
    SemanticsValue,
    NopValue,
    VarValue,
    VarValueKind,
    ThisValue2,
    SuperValue,
    LiteralValue,
    BinaryExprValue,
    PrefixUnaryExprValue,
    PostUnaryExprValue,
    ConditionExprValue,
    CastValue,
    NewClassValue,
    InstanceOfValue,
    FunctionCallBaseValue,
    ElementSetValueKind,
    ElementSetValue,
    ElementGetValueKind,
    ElementGetValue,
    FunctionCallValue,
    ConstructorCallValue,
    ToStringValue,
    ValueBinaryOperator,
    NewClosureFunction,
    UnimplementValue,
    DynamicSetValue,
    DynamicGetValue,
    DynamicCallValue,
    ShapeSetValue,
    ShapeGetValue,
    ShapeCallValue,
    VTableGetValue,
    VTableCallValue,
    VTableSetValue,
    OffsetCallValue,
    OffsetGetValue,
    OffsetSetValue,
    OffsetSetterValue,
    OffsetGetterValue,
    DirectCallValue,
    DirectSetterValue,
    DirectGetterValue,
    DirectGetValue,
    MemberGetValue,
    MemberSetValue,
    MemberCallValue,
    NewLiteralObjectValue,
    NewLiteralArrayValue,
    NewConstructorObjectValue,
    NewFromClassObjectValue,
    ClosureCallValue,
    NewArrayValue,
    NewArrayLenValue,
    TypeofValue,
    AnyCallValue,
    SuperUsageFlag,
    CommaExprValue,
    SpreadValue,
    TemplateExprValue,
    EnumerateKeysGetValue,
} from './value.js';

import {
    SemanticsNode,
    SemanticsKind,
    FunctionDeclareNode,
    VarDeclareNode,
    ModuleNode,
} from './semantics_nodes.js';

import { InternalNames } from './internal.js';

import { flattenConditionValue } from './flatten.js';

import {
    Expression,
    NullKeywordExpression,
    NumberLiteralExpression,
    StringLiteralExpression,
    ObjectLiteralExpression,
    ArrayLiteralExpression,
    FalseLiteralExpression,
    TrueLiteralExpression,
    IdentifierExpression,
    BinaryExpression,
    UnaryExpression,
    ConditionalExpression,
    CallExpression,
    SuperExpression,
    PropertyAccessExpression,
    NewExpression,
    ParenthesizedExpression,
    ElementAccessExpression,
    AsExpression,
    FunctionExpression,
    TypeOfExpression,
    CommaExpression,
    SpreadExpression,
    TemplateExpression,
    EnumerateKeysExpression,
} from '../expression.js';

import {
    Scope,
    ScopeKind,
    ClassScope,
    FunctionScope,
    NamespaceScope,
    GlobalScope,
    importSearchTypes,
} from '../scope.js';

import {
    Type,
    TSClass,
    TsClassField,
    TsClassFunc,
    FunctionKind,
    TypeKind,
    TSFunction,
    TSArray,
    TSInterface,
    TSContext,
    TSUnion,
    builtinTypes,
} from '../type.js';

import {
    BuildContext,
    ValueReferenceKind,
    SymbolKeyToString,
    SymbolKey,
    SymbolValue,
} from './builder_context.js';

import {
    IsBuiltInType,
    IsBuiltInTypeButAny,
    IsBuiltInObjectType,
    GetShapeFromType,
} from './builtin.js';

import {
    MemberType,
    ShapeMember,
    ShapeMethod,
    ShapeField,
    ShapeAccessor,
    Shape,
    ObjectDescription,
    MemberDescription,
    use_shape,
} from './runtime.js';
import { processEscape } from '../utils.js';
import { BuiltinNames } from '../../lib/builtin/builtin_name.js';
import { getConfig } from '../../config/config_mgr.js';

function isInt(expr: Expression): boolean {
    /* TODO: currently we treat all numbers as f64, we can make some analysis and optimize some number to int */
    if (expr.tsNode) {
        // if NumberLiteralExpression represents an array index，we should treat this number as i32
        if (expr.tsNode.parent?.kind == ts.SyntaxKind.ElementAccessExpression)
            return true;
    }
    return false;
}

function toInt(n: number): number {
    return n | 0;
}

function flattenOperator(opKind: ts.SyntaxKind) {
    switch (opKind) {
        case ts.SyntaxKind.PlusEqualsToken: {
            return ts.SyntaxKind.PlusToken;
        }
        case ts.SyntaxKind.MinusEqualsToken: {
            return ts.SyntaxKind.MinusToken;
        }
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken: {
            return ts.SyntaxKind.AsteriskAsteriskToken;
        }
        case ts.SyntaxKind.AsteriskEqualsToken: {
            return ts.SyntaxKind.AsteriskToken;
        }
        case ts.SyntaxKind.SlashEqualsToken: {
            return ts.SyntaxKind.SlashToken;
        }
        case ts.SyntaxKind.PercentEqualsToken: {
            return ts.SyntaxKind.PercentToken;
        }
        case ts.SyntaxKind.AmpersandEqualsToken: {
            return ts.SyntaxKind.AmpersandToken;
        }
        case ts.SyntaxKind.BarEqualsToken: {
            return ts.SyntaxKind.BarToken;
        }
        case ts.SyntaxKind.CaretEqualsToken: {
            return ts.SyntaxKind.CaretToken;
        }
        case ts.SyntaxKind.LessThanLessThanEqualsToken: {
            return ts.SyntaxKind.LessThanLessThanToken;
        }
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken: {
            return ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
        }
        case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken: {
            return ts.SyntaxKind.GreaterThanGreaterThanToken;
        }
        case ts.SyntaxKind.BarBarEqualsToken: {
            return ts.SyntaxKind.BarBarToken;
        }
        case ts.SyntaxKind.AmpersandAmpersandEqualsToken: {
            return ts.SyntaxKind.AmpersandAmpersandToken;
        }
        case ts.SyntaxKind.QuestionQuestionEqualsToken: {
            return ts.SyntaxKind.QuestionQuestionToken;
        }
        case ts.SyntaxKind.PlusPlusToken: {
            return ts.SyntaxKind.PlusEqualsToken;
        }
        case ts.SyntaxKind.MinusMinusToken: {
            return ts.SyntaxKind.MinusEqualsToken;
        }
        case ts.SyntaxKind.MinusToken: {
            return ts.SyntaxKind.MinusToken;
        }
        default:
            return opKind;
    }
}

function getValueFromNamespace(
    ns: VarValue,
    member: string,
    context: BuildContext,
): SemanticsValue {
    if (ns.type.kind != ValueTypeKind.NAMESPACE) {
        throw Error(`${ns} is not a namespace`);
    }

    const ns_scope = ns.ref as Scope;
    Logger.debug(`=== Namespace ${ns_scope.kind} member: ${member}`);

    // find the name in the ns_scope
    let name = ns_scope.findIdentifier(
        member,
        true,
        importSearchTypes.All,
        true,
    );

    if (!name && ns_scope.kind == ScopeKind.GlobalScope) {
        const target_name = (ns_scope as GlobalScope).nameAliasExportMap.get(
            member,
        );
        if (target_name) {
            name = ns_scope.findIdentifier(target_name, true);
        }
    }

    if (!name) {
        throw Error(`cannot find "${member}" in ${ns}`);
    }

    const value = context.globalSymbols.get(name!);

    if (!value) {
        throw Error(`undefiend "${member}" in ${ns} (${name})`);
    }

    const result = SymbolValueToSemanticsValue(value!, context);

    if (result) return result;

    throw Error(`cannot create value "${member}" in ${ns}(${name})`);
}

function buildPropertyAccessExpression(
    expr: PropertyAccessExpression,
    context: BuildContext,
): SemanticsValue {
    // whether the context of property access is in the call expression
    let isMethodCall = false;
    if (
        expr.tsNode &&
        expr.tsNode.parent.kind == ts.SyntaxKind.CallExpression
    ) {
        isMethodCall = true;
    }

    context.pushReference(ValueReferenceKind.RIGHT);
    let own = buildExpression(expr.propertyAccessExpr, context);
    context.popReference();

    let own_name = '';
    if (expr.propertyAccessExpr.expressionKind == ts.SyntaxKind.Identifier) {
        const identifer = expr.propertyAccessExpr as IdentifierExpression;
        own_name = identifer.identifierName;
    }

    if (own.kind == SemanticsValueKind.NOP) {
        throw Error(`buildPropertyAccessExpression: Got NopValue`);
        return own;
    }

    let member_name = (expr.propertyExpr as IdentifierExpression)
        .identifierName;

    const type = own.effectType;
    /**
     * e.g.
     *  class A {
     *      x: number;
     *      constructor(x: number) {
     *          this.x = x;
     *      }
     *
     *      func<T>(param: T) {
     *          return param;
     *      }
     *  }
     *  const a: A = new A(1);
     *  const ret = a.func(2);
     */
    if (isMethodCall) {
        if (
            expr.parent &&
            type instanceof ObjectType &&
            !type.genericOwner &&
            isTypeGeneric(expr.propertyExpr.exprType)
        ) {
            // find the specialized method that needs to be called through the arguments list
            const callExpr = expr.parent as CallExpression;
            if (callExpr.callArgs && callExpr.callArgs.length > 0) {
                const func_type = createType(
                    context,
                    expr.propertyExpr.exprType,
                ) as FunctionType;
                const paramterTypes = func_type.argumentsType;

                const argumentTypes: ValueType[] = [];
                const typeArguments: ValueType[] = [];
                for (let i = 0; i < callExpr.callArgs.length; i++) {
                    const arg = callExpr.callArgs[i];
                    argumentTypes.push(buildExpression(arg, context).type);
                }

                for (let i = 0; i < paramterTypes.length; i++) {
                    if (paramterTypes[i].kind == ValueTypeKind.TYPE_PARAMETER) {
                        if (
                            argumentTypes[i].kind !==
                            ValueTypeKind.TYPE_PARAMETER
                        )
                            typeArguments.push(argumentTypes[i]);
                    } else if (paramterTypes[i].kind == ValueTypeKind.ARRAY) {
                        const elementType = (argumentTypes[i] as ArrayType)
                            .element;
                        if (elementType.kind !== ValueTypeKind.TYPE_PARAMETER)
                            typeArguments.push(elementType);
                    }
                    const typeNames = new Array<string>();
                    typeArguments.forEach((v) => {
                        const name = `${ValueTypeKind[v.kind]}`;
                        typeNames.push(name.toLowerCase());
                    });
                    if (typeNames.length > 0) {
                        const typeSignature = '<' + typeNames.join(',') + '>';
                        member_name = member_name + typeSignature;
                    }
                }
            }
        }
    }

    if (type.kind == ValueTypeKind.ENUM) {
        const enum_type = type as EnumType;
        const value = enum_type.members.get(member_name);
        if (value === undefined) {
            throw Error(`Unkonw enum member "${member_name}" in ${type}`);
        }
        if (typeof value == 'string') {
            return new LiteralValue(Primitive.String, value);
        } else {
            return new LiteralValue(Primitive.Int, value);
        }
    } else if (type.kind == ValueTypeKind.NAMESPACE) {
        return getValueFromNamespace(own as VarValue, member_name, context);
    }

    const ref_type = context.currentReference();
    const member_as_write = ref_type == ValueReferenceKind.LEFT;

    own.incAccessCount();

    Logger.debug(
        `==== buildPropertyAccessExpression own: ${own} shape: ${own.shape}`,
    );

    if (own instanceof VarValue && !(own as VarValue).isConst) {
        /*
          the purpose of copying is to
          prevent subsequent changes to VarValue
          from affecting this semantic processing
       */
        /* e.g.
        let a: A | B = new A();
        let x = a.x;
        a = new B();
        let y = a.y;
        A and B are class types.
        When the “new A()” statement is executed, the Shape of “a” at this time represents A;
        Later, when the “new B()” statement is executed, the shape of “a” at this time represents B;
        Then WASMExpressionGen is executed which will translate semanticsValue to WASM code，
        it needs to find the corresponding VarValue through the identifier name "a".
        At this time, the Shape in the VarValue corresponding to “a” is the shape of B when it was last assigned.
        So when executing "a.x", it means to get attribute x in class B, not in class A.
        In order to avoid this situation, we need to copy the value of “own”.
      */
        own = (own as VarValue).copy();
    }

    const shape = own.shape;
    if (!shape || own.type.kind == ValueTypeKind.ANY) {
        Logger.warn(`WARNING Type has null shape ${type}, use dynamic Access`);
        const dynamicAccess = createDynamicAccess(
            own,
            member_name,
            member_as_write,
            isMethodCall,
        );

        if (own.type instanceof ObjectType) {
            /* Workaround: Array method access */
            /* We still need this workaround:
                class A {
                    static c = 10; //10
                    static readonly d = 12 + A.c; //22
                }
            */
            dynamicAccess.type =
                own.type.meta.findMember(member_name)?.valueType ||
                dynamicAccess.type;
        }

        return dynamicAccess;
    }

    const meta = shape!.meta;
    const isThisShape = meta.isObjectInstance;
    let member = meta.findMember(member_name);
    if (!member || BuiltinNames.fallbackConstructors.includes(own_name)) {
        Logger.warn(`WARNING Not found the member name, use dynamic Access`);
        if (BuiltinNames.fallbackConstructors.includes(own_name)) {
            own.type.kind = ValueTypeKind.ANY;
        }
        return createDynamicAccess(
            own,
            member_name,
            member_as_write,
            isMethodCall,
        );
    }

    const shape_member = shape.getMember(member.index);
    if (!shape_member || shape_member.isEmpty) {
        if (isThisShape)
            return createVTableAccess(
                own,
                member,
                member_as_write,
                isMethodCall,
            );
        else
            return createShapeAccess(
                own,
                member,
                member_as_write,
                isMethodCall,
            );
    }

    /* Workaround: For obj property dynamic access, type member is not equal with shape member, so we should use type member to get DirectAccess value */
    if (type instanceof ObjectType) {
        const typeMeta = type.meta;
        const typeMember = typeMeta.findMember(member_name);
        if (typeMember && typeMember.valueType.kind !== member.valueType.kind) {
            member = typeMember;
        }
    }

    return createDirectAccess(
        own,
        shape_member,
        member,
        member_as_write,
        isThisShape,
        isMethodCall,
    );
}

function createDynamicAccess(
    own: SemanticsValue,
    name: string,
    is_write: boolean,
    is_method_call: boolean,
): SemanticsValue {
    /* iff call Object builtin methods */
    if (BuiltinNames.ObjectBuiltinMethods.includes(name)) {
        if (name === BuiltinNames.ObjectToStringMethod) {
            return new ToStringValue(SemanticsValueKind.VALUE_TO_STRING, own);
        }
    }
    if (is_write) return new DynamicSetValue(own, name);

    return new DynamicGetValue(own, name, is_method_call);
}

function createShapeAccess(
    own: SemanticsValue,
    member: MemberDescription,
    is_write: boolean,
    is_method_call: boolean,
): SemanticsValue {
    if (is_write) return new ShapeSetValue(own, member.valueType, member.index);
    if (member.type == MemberType.METHOD && is_method_call) {
        return new ShapeCallValue(
            own,
            member.valueType as FunctionType,
            member.index,
        );
    }
    return new ShapeGetValue(own, member.valueType, member.index);
}

function createVTableAccess(
    own: SemanticsValue,
    member: MemberDescription,
    is_write: boolean,
    is_method_call: boolean,
): SemanticsValue {
    if (is_write)
        return new VTableSetValue(own, member.valueType, member.index);
    if (member.type == MemberType.METHOD && is_method_call) {
        return new VTableCallValue(
            own,
            member.valueType as FunctionType,
            member.index,
        );
    }
    return new VTableGetValue(own, member.valueType, member.index);
}

function createDirectAccess(
    own: SemanticsValue,
    shape_member: ShapeMember,
    member: MemberDescription,
    is_write: boolean,
    isThisShape: boolean,
    is_method_call: boolean,
): SemanticsValue {
    if (is_write) {
        return createDirectSet(
            own,
            shape_member,
            member,
            isThisShape,
            is_method_call,
        );
    } else {
        return createDirectGet(
            own,
            shape_member,
            member,
            isThisShape,
            is_method_call,
        );
    }
}

function createDirectGet(
    own: SemanticsValue,
    shape_member: ShapeMember,
    member: MemberDescription,
    isThisShape: boolean,
    is_method_call: boolean,
) {
    switch (shape_member.kind) {
        case MemberType.FIELD:
            return new OffsetGetValue(
                own,
                member.valueType,
                (shape_member as ShapeField).offset!,
            );
        case MemberType.ACCESSOR: {
            const accessor = shape_member as ShapeAccessor;
            const getter = accessor.getter;
            if (!getter) {
                Logger.info('==== getter is not exist, access by shape');
                if (isThisShape)
                    return createVTableAccess(own, member, false, true);
                return createShapeAccess(own, member, false, true);
            }
            if (accessor.isOffset) {
                return new OffsetGetterValue(
                    own,
                    member.getterType!,
                    accessor.getterOffset!,
                );
            } else {
                return new DirectGetterValue(
                    own,
                    member.getterType!,
                    accessor.getterValue!,
                );
            }
        }
        case MemberType.METHOD: {
            const method = shape_member as ShapeMethod;
            const func_type = member.valueType as FunctionType;
            if (method.isOffset) {
                if (is_method_call) {
                    return new OffsetCallValue(
                        own,
                        func_type,
                        method.methodOffset!,
                    );
                } else {
                    return new OffsetGetValue(
                        own,
                        func_type,
                        (shape_member as ShapeMethod).methodOffset!,
                    );
                }
            } else {
                if (is_method_call) {
                    return new DirectCallValue(
                        own,
                        func_type,
                        method.methodValue!,
                    );
                } else {
                    return new DirectGetValue(
                        own,
                        member.valueType,
                        member.index,
                    );
                }
            }
            break;
        }
    }

    throw Error(`wrong access`);
}

function createDirectSet(
    own: SemanticsValue,
    shape_member: ShapeMember,
    member: MemberDescription,
    isThisShape: boolean,
    is_method_call: boolean,
) {
    switch (shape_member.kind) {
        case MemberType.FIELD: // get the feild directly
            return new OffsetSetValue(
                own,
                member.valueType,
                (shape_member as ShapeField).offset!,
            );
        case MemberType.ACCESSOR: {
            const accessor = shape_member as ShapeAccessor;
            const setter = accessor.setter;
            if (!setter) {
                Logger.info('==== setter is not exist, access by shape');
                if (isThisShape)
                    return createVTableAccess(own, member, true, true);
                return createShapeAccess(own, member, true, true);
            }
            if (accessor.isOffset) {
                return new OffsetSetterValue(
                    own,
                    member.setterType!,
                    accessor.setterOffset!,
                    accessor.getterOffset,
                );
            } else {
                return new DirectSetterValue(
                    own,
                    member.setterType!,
                    accessor.setterValue!,
                    accessor.getterValue,
                );
            }
        }
    }

    throw Error(`wrong access`);
}

function SymbolValueToSemanticsValue(
    value: SymbolValue,
    context: BuildContext,
): SemanticsValue | undefined {
    if (value instanceof SemanticsValue) return value as SemanticsValue;

    if (value instanceof FunctionDeclareNode) {
        const func_node = value as FunctionDeclareNode;
        return new VarValue(
            SemanticsValueKind.GLOBAL_CONST,
            func_node.funcType,
            func_node,
            -1,
        );
    }

    if (value instanceof VarDeclareNode) {
        const var_decl = value as VarDeclareNode;
        return new VarValue(
            var_decl.storageType as VarValueKind,
            var_decl.type,
            var_decl,
            var_decl.index,
        );
    }

    if (value instanceof EnumType) {
        const enum_type = value as EnumType;
        return new VarValue(
            SemanticsValueKind.GLOBAL_CONST,
            enum_type,
            enum_type,
            -1,
        );
    }

    if (value instanceof ObjectType) {
        const clazz_type = value as ObjectType;
        if (clazz_type.classType) {
            return new VarValue(
                SemanticsValueKind.GLOBAL_CONST,
                clazz_type.classType!,
                clazz_type.classType!,
                -1,
            );
        } else {
            throw Error(`${clazz_type} Cannot load as an identifier`);
        }
    }

    return undefined;
}

function buildIdentiferExpression(
    expr: IdentifierExpression,
    context: BuildContext,
): SemanticsValue {
    const name = expr.identifierName;

    if (name == 'undefined') {
        return new LiteralValue(Primitive.Undefined, undefined);
    }
    if (name == 'NaN') {
        return new LiteralValue(Primitive.Number, NaN);
    }
    if (name == 'Infinity') {
        return new LiteralValue(Primitive.Number, Infinity);
    }

    let ret = context.findVariable(name);
    if (!ret) {
        Logger.debug(`=== try find identifer "${name}" as Varaible Faield`);
        ret = context.findFunction(name);
    }
    if (!ret) {
        Logger.debug(`=== try find identifer "${name}" as Function Faield`);
        ret = context.findType(name);
    }
    if (!ret) {
        Logger.debug(`=== try find identifer "${name}" as Type Faield`);
        ret = context.findNamespace(name);
    }

    if (ret) {
        Logger.debug(`=== found identifer "${name}" ${ret}`);
        const result = SymbolValueToSemanticsValue(ret, context);
        if (result) return result;
    }

    throw Error(`Cannot find the idenentifier "${name}"`);
}

function buildTypeOfExpression(
    expr: TypeOfExpression,
    context: BuildContext,
): SemanticsValue {
    const typeKind = expr.expr.exprType.kind;
    let res: SemanticsValue;
    switch (typeKind) {
        case TypeKind.STRING:
            res = new LiteralValue(Primitive.String, 'string');
            break;
        case TypeKind.NUMBER:
            res = new LiteralValue(Primitive.String, 'number');
            break;
        case TypeKind.BOOLEAN:
            res = new LiteralValue(Primitive.String, 'boolean');
            break;
        case TypeKind.UNDEFINED:
            res = new LiteralValue(Primitive.String, 'undefined');
            break;
        case TypeKind.FUNCTION:
            res = new LiteralValue(Primitive.String, 'function');
            break;
        case TypeKind.ARRAY:
        case TypeKind.ENUM:
        case TypeKind.INTERFACE:
        case TypeKind.CLASS:
        case TypeKind.NULL:
            res = new LiteralValue(Primitive.String, 'object');
            break;
        case TypeKind.UNION:
        case TypeKind.ANY: {
            res = new TypeofValue(buildExpression(expr.expr, context));
            break;
        }
        default:
            throw new Error(`unimpl typeof's expression type ${typeKind}`);
    }
    return res;
}

// convert `Hello ${name} World` to the format
// "Hello " [name, " World"], and then call
// `String.concat` to concat them in the backend
function buildTemplateExpression(
    expr: TemplateExpression,
    context: BuildContext,
): SemanticsValue {
    const head = buildExpression(expr.head, context);
    const follows: SemanticsValue[] = [];
    for (const span of expr.spans) {
        let expr = buildExpression(span.expr, context);
        expr = newCastValue(Primitive.String, expr);
        follows.push(expr);
        const middle_or_tail = buildExpression(span.literal, context);
        follows.push(middle_or_tail);
    }
    return new TemplateExprValue(head, follows);
}

function findObjectLiteralType(
    type: TSClass,
    context: BuildContext,
): ObjectType {
    const vt = context.findValueType(type);
    if (vt) return vt as ObjectType;

    const obj_type = createObjectType(type, context)!;
    context.runAllTasks();

    return obj_type;
}

function buildObjectLiteralExpression(
    expr: ObjectLiteralExpression,
    context: BuildContext,
): SemanticsValue {
    const type = expr.exprType as TSClass;
    const object_type = findObjectLiteralType(type as TSClass, context);
    const value = new NewLiteralObjectValue(object_type);

    /*
        eg.  arr = [{a:1}, {a:2}, {a:3, b:4}]
        TSC treate arr type is Array<{a:number, b?: number} | {a:number, b:number}>
     */

    const meta = object_type.meta;
    for (let i = 0; i < expr.objectFields.length; i++) {
        const name_ = expr.objectFields[i].identifierName;
        const name = processEscape(name_);
        const member = meta.findMember(name);

        if (member) {
            context.pushReference(ValueReferenceKind.RIGHT);
            const init_value = buildExpression(expr.objectValues[i], context);
            context.popReference();

            value.setField(member.index, init_value);
        } else {
            throw Error(`Cannot init the ${name}@${i} of ${object_type}`);
        }
    }
    return value;
}

function buildArrayLiteralExpression(
    expr: ArrayLiteralExpression,
    context: BuildContext,
): SemanticsValue {
    if (expr.arrayValues.length == 0) {
        if (
            expr.exprType instanceof TSArray &&
            expr.exprType.elementType.kind == TypeKind.UNKNOWN
        )
            return new NewArrayLenValue(
                GetPredefinedType(PredefinedTypeId.ARRAY_ANY)! as ArrayType,
                new LiteralValue(Primitive.Int, 0),
            );
    }

    const init_values: SemanticsValue[] = [];
    let array_type = context.findValueType(expr.exprType);

    let init_types: Set<ValueType> | undefined = undefined;
    if (!array_type || array_type.kind != ValueTypeKind.ARRAY) {
        init_types = new Set<ValueType>();
    }

    // element type calculated from exprType
    let element_type: ValueType | undefined;
    if (array_type instanceof ArrayType) {
        element_type = (<ArrayType>array_type).element;
    }

    for (const element of expr.arrayValues) {
        context.pushReference(ValueReferenceKind.RIGHT);
        let v = buildExpression(element, context);
        if (element_type != undefined) {
            v = newCastValue(element_type, v);
        }
        context.popReference();
        init_values.push(v);
        // if v is SpreadValue, add it's elem-type to init_types
        let v_type = v.type;
        if (v instanceof SpreadValue) {
            const target = v.target;
            if (target.type.kind == ValueTypeKind.ARRAY) {
                v_type = (target.type as ArrayType).element;
            } else if (target.type.kind == ValueTypeKind.ANY) {
                v_type = target.type;
            }
        }
        if (init_types) {
            init_types.add(v_type);
        }
    }

    if (init_types) {
        array_type = createArrayType(
            context,
            CreateWideTypeFromTypes(context, init_types),
        );
    }

    const elem_type = (array_type as ArrayType).element;
    const initValues =
        expr.arrayValues.length == 0
            ? []
            : init_values.map((v) => {
                  return elem_type.equals(v.type)
                      ? v
                      : newCastValue(elem_type, v);
              });
    // process generic array type
    if (initValues.length > 0) {
        // actual element type
        const value_type = initValues[0].type;
        if (
            elem_type.kind == ValueTypeKind.TYPE_PARAMETER &&
            !value_type.equals(elem_type)
        )
            array_type = createArrayType(context, value_type);
    }

    return new NewLiteralArrayValue(array_type!, initValues);
}

export function isEqualOperator(kind: ts.SyntaxKind): boolean {
    return (
        kind == ts.SyntaxKind.EqualsToken ||
        kind == ts.SyntaxKind.PlusEqualsToken ||
        kind == ts.SyntaxKind.MinusEqualsToken ||
        kind == ts.SyntaxKind.AsteriskEqualsToken ||
        kind == ts.SyntaxKind.AsteriskAsteriskEqualsToken ||
        kind == ts.SyntaxKind.SlashEqualsToken ||
        kind == ts.SyntaxKind.PercentEqualsToken ||
        kind == ts.SyntaxKind.AmpersandEqualsToken ||
        kind == ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
        kind == ts.SyntaxKind.BarEqualsToken ||
        kind == ts.SyntaxKind.BarBarEqualsToken ||
        kind == ts.SyntaxKind.CaretEqualsToken
    );
}

export function isCompareOperator(kind: ts.SyntaxKind): boolean {
    return (
        kind == ts.SyntaxKind.LessThanEqualsToken ||
        kind == ts.SyntaxKind.LessThanToken ||
        kind == ts.SyntaxKind.GreaterThanEqualsToken ||
        kind == ts.SyntaxKind.GreaterThanToken ||
        kind == ts.SyntaxKind.EqualsEqualsToken ||
        kind == ts.SyntaxKind.EqualsEqualsEqualsToken ||
        kind == ts.SyntaxKind.ExclamationEqualsToken ||
        kind == ts.SyntaxKind.ExclamationEqualsEqualsToken
    );
}

function wrapObjToAny(value: SemanticsValue, type: ValueType) {
    if (
        value instanceof NewLiteralObjectValue ||
        value instanceof NewLiteralArrayValue
    ) {
        for (let i = 0; i < value.initValues.length; i++) {
            const elemValue = value.initValues[i];
            if (
                elemValue instanceof NewLiteralObjectValue ||
                elemValue instanceof NewLiteralArrayValue
            ) {
                value.initValues[i] = wrapObjToAny(elemValue, type);
            } else {
                if (type.kind == ValueTypeKind.ANY) {
                    value.initValues[i] = newCastValue(type, elemValue);
                }
            }
        }
    }
    return new CastValue(SemanticsValueKind.OBJECT_CAST_ANY, type, value);
}

export function newCastValue(
    type: ValueType,
    value: SemanticsValue,
): SemanticsValue {
    if (type.equals(value.type)) return value;
    if (value instanceof SpreadValue) return value;
    else if (type.kind == ValueTypeKind.TYPE_PARAMETER)
        type = (type as TypeParameterType).wideType;
    else if (type.kind == ValueTypeKind.ENUM)
        type = (type as EnumType).memberType;

    let value_type = value.effectType;
    if (value_type.kind == ValueTypeKind.ENUM) {
        value_type = (value_type as EnumType).memberType;
    }
    if (value_type.kind == ValueTypeKind.UNION) {
        if (type.kind == ValueTypeKind.ANY) {
            return new CastValue(
                SemanticsValueKind.UNION_CAST_ANY,
                type,
                value,
            );
        } else if (type.kind == ValueTypeKind.BOOLEAN) {
            return new CastValue(
                SemanticsValueKind.UNION_CAST_VALUE,
                type,
                value,
            );
        } else if (isObjectType(type.kind)) {
            return new CastValue(
                SemanticsValueKind.UNION_CAST_OBJECT,
                type,
                value,
            );
        } else {
            return new CastValue(
                SemanticsValueKind.UNION_CAST_VALUE,
                type,
                value,
            );
        }
    }
    if (
        value_type.kind == ValueTypeKind.GENERIC &&
        type.kind == ValueTypeKind.GENERIC
    ) {
        // it's template type
        return value;
    }

    if (type.equals(value_type)) return value;

    if (
        type.kind == ValueTypeKind.FUNCTION &&
        value_type.kind == ValueTypeKind.FUNCTION
    )
        return value;

    if (
        type.kind == ValueTypeKind.ARRAY &&
        value_type.kind == ValueTypeKind.ARRAY
    ) {
        const arr_type = type as ArrayType;
        const arr_value_type = value_type as ArrayType;

        let arr_element_type = arr_type.element;
        let value_element_type = arr_value_type.element;

        if (arr_element_type.kind == ValueTypeKind.TYPE_PARAMETER)
            arr_element_type = (arr_element_type as TypeParameterType).wideType;

        if (value_element_type.kind == ValueTypeKind.TYPE_PARAMETER)
            value_element_type = (value_element_type as TypeParameterType)
                .wideType;

        if (arr_element_type.equals(value_element_type)) return value;

        if (
            arr_element_type.kind == ValueTypeKind.ANY &&
            value_element_type.kind == ValueTypeKind.ANY
        )
            return value;

        /* TODO: need to create new CastValue from Array<NUMBER(6)(OBJECT)> to  Array<ANY(10)(OBJECT)> */
        if (
            isObjectType(arr_element_type.kind) &&
            isObjectType(value_element_type.kind)
        )
            return value;
        if (
            (arr_element_type.kind == ValueTypeKind.RAW_STRING ||
                arr_element_type.kind == ValueTypeKind.STRING) &&
            (value_element_type.kind == ValueTypeKind.STRING ||
                value_element_type.kind == ValueTypeKind.RAW_STRING)
        )
            return value;
        if (
            (arr_element_type.kind == ValueTypeKind.NUMBER ||
                arr_element_type.kind == ValueTypeKind.BOOLEAN ||
                arr_element_type.kind == ValueTypeKind.INT) &&
            (value_element_type.kind == ValueTypeKind.NUMBER ||
                value_element_type.kind == ValueTypeKind.BOOLEAN ||
                value_element_type.kind == ValueTypeKind.INT)
        )
            return value;

        throw Error(
            `cannot make cast value from "${value_type}" to  "${type}"`,
        );
    }

    if (
        (type.kind == ValueTypeKind.RAW_STRING &&
            value_type.kind == ValueTypeKind.STRING) ||
        (type.kind == ValueTypeKind.STRING &&
            value_type.kind == ValueTypeKind.RAW_STRING)
    ) {
        return value;
    }

    if (
        type.kind == ValueTypeKind.STRING ||
        type.kind == ValueTypeKind.RAW_STRING
    ) {
        if (isObjectType(value_type.kind)) {
            return new ToStringValue(
                SemanticsValueKind.OBJECT_TO_STRING,
                value,
            );
        }
        if (value_type.kind == ValueTypeKind.ANY) {
            return new CastValue(
                SemanticsValueKind.ANY_CAST_VALUE,
                type,
                value,
            );
        } else {
            return new ToStringValue(SemanticsValueKind.VALUE_TO_STRING, value);
        }
    }

    if (type.kind == ValueTypeKind.BOOLEAN) {
        if (value_type.kind == ValueTypeKind.ANY)
            return new CastValue(
                SemanticsValueKind.ANY_CAST_VALUE,
                type,
                value,
            );
        // object check is null or undefiend
        if (isObjectType(type.kind))
            return new CastValue(
                SemanticsValueKind.OBJECT_CAST_VALUE,
                type,
                value,
            );
        return new CastValue(SemanticsValueKind.VALUE_CAST_VALUE, type, value);
    }

    if (type.kind == ValueTypeKind.INT || type.kind == ValueTypeKind.NUMBER) {
        if (
            value_type.kind == ValueTypeKind.NUMBER ||
            value_type.kind == ValueTypeKind.INT ||
            value_type.kind == ValueTypeKind.BOOLEAN ||
            value_type.kind == ValueTypeKind.STRING ||
            value_type.kind == ValueTypeKind.RAW_STRING ||
            isNullValueType(value_type.kind)
        )
            return new CastValue(
                SemanticsValueKind.VALUE_CAST_VALUE,
                type,
                value,
            );
        if (value_type.kind == ValueTypeKind.ANY)
            return new CastValue(
                SemanticsValueKind.ANY_CAST_VALUE,
                type,
                value,
            );
        throw Error(
            `cannot make cast value from "${value_type}" to  "${type}"`,
        );
    }

    if (isNullValueType(type.kind)) {
        if (value_type.kind == ValueTypeKind.ANY) {
            return new CastValue(
                SemanticsValueKind.ANY_CAST_VALUE,
                type,
                value,
            );
        } else if (isObjectType(value_type.kind)) {
            return new CastValue(
                SemanticsValueKind.OBJECT_CAST_VALUE,
                type,
                value,
            );
        }
        return new CastValue(SemanticsValueKind.VALUE_CAST_VALUE, type, value);
    }

    if (type.kind == ValueTypeKind.ANY) {
        if (isObjectType(value_type.kind)) {
            return wrapObjToAny(value, type);
        }
        return new CastValue(SemanticsValueKind.VALUE_CAST_ANY, type, value);
    }

    if (type.kind == ValueTypeKind.UNION) {
        if (isObjectType(value_type.kind))
            return new CastValue(
                SemanticsValueKind.OBJECT_CAST_UNION,
                type,
                value,
            );
        return new CastValue(SemanticsValueKind.VALUE_CAST_UNION, type, value);
    }

    /////////
    // object shape translate
    if (
        type.kind == ValueTypeKind.OBJECT &&
        value_type.kind == ValueTypeKind.OBJECT
    ) {
        const from_value = value;
        const from_obj_type = value_type as ObjectType;
        // check value_type's shape
        let from_shape = value.shape;
        if (!from_shape) {
            // value has no shape cast to new shaped value
            // try get from object
            const meta = from_obj_type.meta;
            from_shape = meta.originShape; // get the originShape
        }
        const to_meta = (type as ObjectType).meta;
        let to_shape = to_meta.originShape;

        /* to_meta may differ from from_meta, like undefined
        interface NoddOptions {
            attrs?: number
        }
        const opts: NoddOptions = {}
         */
        if (
            from_value instanceof NewLiteralObjectValue &&
            to_meta.members.length > from_obj_type.meta.members.length
        ) {
            for (const to_member of to_meta.members) {
                if (
                    from_obj_type.meta.members.find((from_member) => {
                        return from_member.name === to_member.name;
                    })
                ) {
                    continue;
                }
                if (
                    to_member.valueType.kind === ValueTypeKind.UNION &&
                    (<UnionType>to_member.valueType).types.has(
                        Primitive.Undefined,
                    )
                ) {
                    (from_value as NewLiteralObjectValue).initValues.push(
                        new LiteralValue(Primitive.Undefined, undefined),
                    );
                    const curLen = (from_value.type as ObjectType).meta.members
                        .length;
                    (from_value.type as ObjectType).meta.members.push(
                        new MemberDescription(
                            to_member.name,
                            to_member.type,
                            curLen,
                            to_member.isOptional,
                            to_member.valueType,
                        ),
                    );
                }
            }
        }

        if (from_shape && from_shape.isStaticShape()) {
            to_shape = to_meta.buildShape(from_shape);
        }
        const cast_value = new CastValue(
            SemanticsValueKind.OBJECT_CAST_OBJECT,
            type,
            from_value,
        );
        cast_value.shape = to_shape;
        return cast_value;
    }

    if (isObjectType(type.kind) && value_type.kind == ValueTypeKind.ANY) {
        return new CastValue(SemanticsValueKind.ANY_CAST_OBJECT, type, value);
    }

    if (
        (value_type.kind === ValueTypeKind.NULL &&
            type.kind === ValueTypeKind.OBJECT) ||
        type.kind === ValueTypeKind.FUNCTION
    ) {
        /* null to object don't require cast */
        return value;
    }

    if (
        type.kind === ValueTypeKind.GENERIC &&
        value_type.kind !== ValueTypeKind.GENERIC
    ) {
        /* no cast is required from other types to generic type */
        return value;
    }

    throw Error(`cannot make cast value from "${value_type}" to  "${type}"`);
}

function typeUp(up: ValueType, down: ValueType): boolean {
    if (down.kind == ValueTypeKind.ANY) return true;

    if (
        up.kind == ValueTypeKind.NUMBER &&
        (down.kind == ValueTypeKind.INT || down.kind == ValueTypeKind.BOOLEAN)
    )
        return true;

    if (up.kind == ValueTypeKind.INT && down.kind == ValueTypeKind.BOOLEAN)
        return true;

    if (up.kind == ValueTypeKind.STRING || up.kind == ValueTypeKind.RAW_STRING)
        return true;

    if (
        up.kind == ValueTypeKind.OBJECT &&
        (down.kind == ValueTypeKind.UNDEFINED ||
            down.kind == ValueTypeKind.NULL)
    ) {
        return true;
    }

    return false;
}

function typeTranslate(type1: ValueType, type2: ValueType): ValueType {
    if (type1.equals(type2)) return type1;

    if (typeUp(type1, type2)) return type1;

    if (typeUp(type2, type1)) return type2;

    throw Error(`"${type1}" aginst of "${type2}"`);
}

export function shapeAssignCheck(left: ValueType, right: ValueType) {
    // iff the type of lvalue is 'any', we should never fix its shape.
    if (left.equals(Primitive.Any)) return false;

    if (
        left.kind == ValueTypeKind.OBJECT &&
        right.kind == ValueTypeKind.OBJECT
    ) {
        const leftMeta = (left as ObjectType).meta;
        const rightMeta = (right as ObjectType).meta;
        if (rightMeta.members.length >= leftMeta.members.length) {
            for (const left_member of leftMeta.members) {
                const right_member = rightMeta.findMember(left_member.name);
                /* e.g.
                 interface I {
                     x?: number;
                 }
                 class A {
                     y = 10;
                     z = true;
                 }

                 const a = new A();
                 const i: I = a;
                */
                if (!right_member) return false; // Property 'x' is missing in type 'A' but required in type 'I'.
                /* e.g.
                 interface I {
                     x?: number;
                 }
                 class A {
                     x = 10;
                     y = true;
                 }

                 const a = new A();
                 const i: I = a;
                */
                if (left_member.isOptional && !right_member.isOptional)
                    return false;

                if (
                    left_member.valueType instanceof UnionType &&
                    !(right_member.valueType instanceof UnionType)
                ) {
                    return false;
                }
            }
        } else {
            /* e.g.
                 interface I {
                     x: number;
                     y?: boolean;
                 }
                 class A {
                     x = 10;
                 }

                 const a = new A();
                 const i: I = a;
            */
            return false; // property 'y' is missing in type 'A' but required in type 'I'.
        }
    }
    return true;
}

export function newBinaryExprValue(
    type: ValueType | undefined,
    opKind: ValueBinaryOperator,
    left_value: SemanticsValue,
    right_value: SemanticsValue,
): SemanticsValue {
    const is_equal = isEqualOperator(opKind);

    Logger.debug(
        `=== newBinaryExprValue left_value type ${left_value.effectType}`,
    );

    if (
        is_equal &&
        shapeAssignCheck(left_value.effectType, right_value.effectType)
    )
        left_value.shape = right_value.shape;

    if (isCompareOperator(opKind)) {
        /** Adding instanceof to the comparison operator can result in type coercion to any,
         * which prevents compile-time verification of the instanceof relationship.
         */
        /* TSC can guarantee that the types must be the same when both sides are primitive types.
           And if the type of lvalue and rvalue are both primitive types,
           there is no need to convert the type of lvalue and the type of rvalue to "any".
        */
        if (!left_value.type.isPrimitive || !right_value.type.isPrimitive) {
            left_value = newCastValue(Primitive.Any, left_value);
            right_value = newCastValue(Primitive.Any, right_value);
        }
    } else if (
        left_value.type.isSpecialized() &&
        !right_value.type.isSpecialized() &&
        left_value.type.genericOwner!.equals(right_value.type)
    ) {
        //e.g const a : number[] = new Array();
        right_value.type = left_value.type;
        if (is_equal && isMemberSetValue(left_value)) {
            return updateSetValue(left_value, right_value, opKind);
        }
    } else if (!left_value.effectType.equals(right_value.effectType)) {
        if (is_equal) {
            if (
                right_value instanceof NewArrayLenValue &&
                left_value.type.kind === ValueTypeKind.ARRAY
            ) {
                /* For NewArrayLenValue with zero length,
                    update the array type according to the assign target */
                right_value.type = left_value.type;
            } else {
                right_value = newCastValue(left_value.effectType, right_value);
                if (isMemberSetValue(left_value)) {
                    return updateSetValue(left_value, right_value, opKind);
                }
            }
        } else if (opKind !== ts.SyntaxKind.InstanceOfKeyword) {
            const target_type = typeTranslate(
                left_value.effectType,
                right_value.effectType,
            );
            if (!target_type.equals(left_value.effectType))
                left_value = newCastValue(target_type, left_value);
            if (!target_type.equals(right_value.effectType))
                right_value = newCastValue(target_type, right_value);
        }
    } else {
        if (is_equal && isMemberSetValue(left_value)) {
            return updateSetValue(left_value, right_value, opKind);
        }
    }

    let result_type = type ?? left_value.effectType;
    if (isCompareOperator(opKind)) {
        result_type = Primitive.Boolean;
    }
    if (opKind === ts.SyntaxKind.InstanceOfKeyword) {
        result_type = Primitive.Boolean;
    }

    const bin_value = new BinaryExprValue(
        result_type,
        opKind,
        left_value,
        right_value,
    );
    bin_value.shape = left_value.shape;
    return bin_value;
}

function isMemberSetValue(v: SemanticsValue): boolean {
    return (
        v.kind == SemanticsValueKind.DYNAMIC_SET ||
        v.kind == SemanticsValueKind.OFFSET_SET ||
        v.kind == SemanticsValueKind.OFFSET_SETTER ||
        v.kind == SemanticsValueKind.SHAPE_SET ||
        v.kind == SemanticsValueKind.DIRECT_SETTER ||
        v.kind == SemanticsValueKind.VTABLE_SET ||
        v.kind == SemanticsValueKind.STRING_INDEX_SET ||
        v.kind == SemanticsValueKind.ARRAY_INDEX_SET ||
        v.kind == SemanticsValueKind.OBJECT_INDEX_SET ||
        v.kind == SemanticsValueKind.OBJECT_KEY_SET
    );
}

function isMemberCallValue(kind: SemanticsValueKind): boolean {
    return (
        kind == SemanticsValueKind.DYNAMIC_CALL ||
        kind == SemanticsValueKind.SHAPE_CALL ||
        kind == SemanticsValueKind.VTABLE_CALL ||
        kind == SemanticsValueKind.OFFSET_CALL ||
        kind == SemanticsValueKind.DIRECT_CALL
    );
}

function isMemberGetValue(kind: SemanticsValueKind): boolean {
    return (
        kind == SemanticsValueKind.DYNAMIC_GET ||
        kind == SemanticsValueKind.SHAPE_GET ||
        kind == SemanticsValueKind.VTABLE_GET ||
        kind == SemanticsValueKind.OFFSET_GET ||
        kind == SemanticsValueKind.OFFSET_GETTER ||
        kind == SemanticsValueKind.DIRECT_GETTER
    );
}

function updateSetValue(
    left: SemanticsValue,
    right: SemanticsValue,
    op: ValueBinaryOperator,
): SemanticsValue {
    if (left instanceof ElementSetValue) {
        const es = left as ElementSetValue;
        es.value = right;
        es.opKind = op;
    } else {
        const ps = left as MemberSetValue;
        ps.value = right;
        ps.opKind = op;
    }
    return left;
}

function buildBinaryExpression(
    expr: BinaryExpression,
    context: BuildContext,
): SemanticsValue {
    const is_equal = isEqualOperator(expr.operatorKind);
    context.pushReference(
        is_equal ? ValueReferenceKind.LEFT : ValueReferenceKind.RIGHT,
    );
    const left_value = buildExpression(expr.leftOperand, context);
    left_value.incAccessCount();
    context.popReference();

    /* FIX ME: This code is a workaround!!!
       In order to make the test case [array_every_interface] in array_every.ts pass, we add this code.
       Need to find a solution from the root.
    */
    const rightOperand = expr.rightOperand;
    if (rightOperand instanceof ArrayLiteralExpression) {
        const arrayLiteralExpression = rightOperand as ArrayLiteralExpression;
        if (arrayLiteralExpression.exprType instanceof TSArray) {
            const arr_type = arrayLiteralExpression.exprType as TSArray;
            const element_type = arr_type.elementType;
            if (element_type instanceof TSClass) {
                const class_type = element_type as TSClass;
                if (class_type.isLiteral) {
                    if (expr.leftOperand instanceof PropertyAccessExpression) {
                        const left =
                            expr.leftOperand as PropertyAccessExpression;
                        const own =
                            left.propertyAccessExpr as IdentifierExpression;
                        const property =
                            left.propertyExpr as IdentifierExpression;
                        const own_type = property.exprType;
                        rightOperand.setExprType(own_type);
                    }
                }
            }
        }
    }

    context.pushReference(ValueReferenceKind.RIGHT);
    let operatorKind = expr.operatorKind;
    const flatten_opKind = flattenOperator(expr.operatorKind);
    const isCompoundAssignmentOp = !(flatten_opKind === expr.operatorKind);
    let right_value = buildExpression(expr.rightOperand, context);
    if (isCompoundAssignmentOp) {
        right_value = newBinaryExprValue(
            undefined,
            flatten_opKind as ValueBinaryOperator,
            buildExpression(expr.leftOperand, context),
            right_value,
        );
        operatorKind = ts.SyntaxKind.EqualsToken;
    }
    right_value.incAccessCount();
    context.popReference();

    if (is_equal && expr.leftOperand instanceof PropertyAccessExpression) {
        const properexpr = expr.leftOperand as PropertyAccessExpression;
        if (
            properexpr.propertyAccessExpr.exprType.kind == TypeKind.ARRAY &&
            properexpr.propertyExpr instanceof IdentifierExpression &&
            properexpr.propertyExpr.identifierName == 'length'
        ) {
            left_value.type = Primitive.Int;
            right_value.type = Primitive.Int;
        }
    }

    return newBinaryExprValue(
        undefined,
        operatorKind as ValueBinaryOperator,
        left_value,
        right_value,
    );
}

function buildCommaExpression(
    commaExpr: CommaExpression,
    context: BuildContext,
): SemanticsValue {
    const exprs: SemanticsValue[] = [];
    for (const e of commaExpr.exprs) {
        context.pushReference(ValueReferenceKind.RIGHT);
        exprs.push(buildExpression(e, context));
        context.popReference();
    }
    const type = context.findValueType(commaExpr.exprType)!;
    return new CommaExprValue(type, exprs);
}

function buildConditionalExpression(
    expr: ConditionalExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    let condition = buildExpression(expr.condtion, context);
    condition = newCastValue(Primitive.Boolean, condition);
    context.popReference();

    context.pushReference(ValueReferenceKind.RIGHT);
    const true_value = buildExpression(expr.whenTrue, context);
    true_value.incAccessCount();
    context.popReference();

    context.pushReference(ValueReferenceKind.RIGHT);
    const false_value = buildExpression(expr.whenFalse, context);
    false_value.incAccessCount();
    context.popReference();

    let result_type = true_value.type;
    if (!result_type.equals(false_value.type)) {
        result_type = createUnionType(
            context,
            new Set([true_value.type, false_value.type]),
        );
    }

    const conditon_expr = new ConditionExprValue(
        result_type,
        condition,
        true_value,
        false_value,
    );

    return conditon_expr;
    // return flattenConditionValue(conditon_expr);
}

function getClassContructorType(obj_type: ObjectType): SemanticsValue {
    if (!obj_type.isClassObject()) {
        throw Error(`ObjectType is not a class ${obj_type}`);
    }

    const meta = obj_type.meta;
    const ctr = meta.findConstructor();
    if (
        !ctr ||
        (ctr.type != MemberType.METHOD && ctr.type != MemberType.CONSTRUCTOR)
    ) {
        throw Error(`ObjectType is not a constructor ${obj_type}`);
    }

    const shape = meta.originShape;
    const shape_member = shape!.getMember(ctr.index);
    if (!shape_member) {
        throw Error(`ObjectType constructor must exist: ${obj_type}`);
    }

    return (shape_member as ShapeMethod).method! as SemanticsValue;
}

function createMemberCallValue(
    getter: MemberGetValue,
    funcType: FunctionType,
): MemberCallValue | undefined {
    switch (getter.kind) {
        case SemanticsValueKind.DYNAMIC_GET:
            return new DynamicCallValue(
                getter.owner,
                (getter as DynamicGetValue).name,
            );
        case SemanticsValueKind.SHAPE_GET:
            return new ShapeCallValue(
                getter.owner,
                funcType,
                (getter as ShapeGetValue).index,
            );
        case SemanticsValueKind.VTABLE_GET:
            return new VTableCallValue(
                getter.owner,
                funcType,
                (getter as VTableGetValue).index,
            );
        case SemanticsValueKind.OFFSET_GET:
            return new OffsetCallValue(
                getter.owner,
                funcType,
                (getter as OffsetGetValue).index,
            );
    }

    return undefined;
}

function buildParameters(
    context: BuildContext,
    args: Expression[],
    func_type?: FunctionType,
): SemanticsValue[] {
    const params: SemanticsValue[] = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        let arg_type = Primitive.Any;
        if (func_type) {
            arg_type = func_type.getParamType(i) ?? Primitive.Any;
        }
        context.pushReference(ValueReferenceKind.RIGHT);
        const arg_value = buildExpression(arg, context);
        arg_value.incAccessCount();
        const value = newCastValue(arg_type, arg_value);
        context.popReference();
        params.push(value);
    }
    return params;
}

function buildTypeArguments(context: BuildContext, types: Type[]): ValueType[] {
    const typeArgs: ValueType[] = [];

    for (const t of types) {
        const vt = context.findValueTypeByKey(t);
        if (!vt) {
            throw Error(`buildTypeArguments faield: from ${t}`);
        }
        if (vt instanceof ObjectType) {
            typeArgs.push(vt.instanceType!);
        }
        typeArgs.push(vt);
    }
    return typeArgs;
}

function updateValueTypeByTypeArguments(
    valueType: ValueTypeWithArguments,
    typeArgs: ValueType[],
): ValueType {
    if (valueType.typeArguments) {
        const mapper = new SpecializeTypeMapper(valueType, typeArgs);
        return mapper.getValueType(valueType);
    }
    return valueType;
}

class GuessTypeArguments {
    typeArgs: ValueType[];
    constructor(public typeArguments: TypeParameterType[]) {
        this.typeArgs = new Array<ValueType>(typeArguments.length);
    }

    guessType(templateType: ValueType, valueType: ValueType) {
        if (templateType.kind == ValueTypeKind.TYPE_PARAMETER) {
            this.updateTypeMap(templateType as TypeParameterType, valueType);
            return;
        }

        if (templateType.kind == ValueTypeKind.UNION) {
            const unionType = templateType as UnionType;
            unionType.types.forEach((t) => {
                if (t.kind == ValueTypeKind.TYPE_PARAMETER) {
                    this.updateTypeMap(t as TypeParameterType, valueType);
                }
            });
            return;
        }

        if (valueType.kind != templateType.kind) {
            throw Error(
                `Cannot guess the value type: template: ${templateType}, valueType: ${valueType}`,
            );
        }

        switch (valueType.kind) {
            case ValueTypeKind.OBJECT:
            case ValueTypeKind.ARRAY:
                this.guessObjectType(
                    templateType as ObjectType,
                    valueType as ObjectType,
                );
                break;

            case ValueTypeKind.FUNCTION:
                this.guessFunctionType(
                    templateType as FunctionType,
                    valueType as FunctionType,
                );
                break;
        }
    }

    updateTypeMap(typeType: TypeParameterType, valueType: ValueType) {
        const idx = this.typeArguments.indexOf(typeType);
        if (idx >= 0 && !this.typeArgs[idx]) this.typeArgs[idx] = valueType;
    }

    guessObjectType(templateObjType: ObjectType, objType: ObjectType) {
        if (
            objType.genericOwner === templateObjType &&
            templateObjType.typeArguments &&
            objType.specialTypeArguments
        ) {
            for (
                let i = 0;
                i < templateObjType.typeArguments.length &&
                i < objType.specialTypeArguments.length;
                i++
            ) {
                this.guessType(
                    templateObjType.typeArguments[i],
                    objType.specialTypeArguments[i],
                );
            }
        }
    }

    guessFunctionType(templateFuncType: FunctionType, valueType: FunctionType) {
        // TODO Remove CLOSURECONTEXT && EMPTY to function type
        let arg_idx = 0;
        let temp_idx = 0;
        while (
            arg_idx < valueType.argumentsType.length &&
            temp_idx < templateFuncType.argumentsType.length
        ) {
            const arg_type = valueType.argumentsType[arg_idx];
            if (
                arg_type.kind == ValueTypeKind.CLOSURECONTEXT ||
                arg_type.kind == ValueTypeKind.EMPTY
            ) {
                arg_idx++;
                continue;
            }
            const temp_type = templateFuncType.argumentsType[temp_idx];
            if (
                temp_type.kind == ValueTypeKind.CLOSURECONTEXT ||
                temp_type.kind == ValueTypeKind.EMPTY
            ) {
                temp_idx++;
                continue;
            }

            this.guessType(temp_type, arg_type);
            arg_idx++;
            temp_idx++;
        }
        this.guessType(templateFuncType.returnType, valueType.returnType);
    }
}

function specializeFuncTypeArgumentsByArgs(
    context: BuildContext,
    func_type: FunctionType,
    args: Expression[],
    ret_type: Type,
): ValueType[] {
    const guess = new GuessTypeArguments(func_type.typeArguments!);
    // TODO Remove CLOSURECONTEXT && EMPTY to function type
    let arg_idx = 0;
    let temp_idx = 0;
    while (temp_idx < func_type.argumentsType.length && arg_idx < args.length) {
        const temp_type = func_type.getParamType(temp_idx)!;
        if (
            temp_type.kind == ValueTypeKind.CLOSURECONTEXT ||
            temp_type.kind == ValueTypeKind.EMPTY
        ) {
            temp_idx++;
            continue;
        }

        const arg_type = context.findValueTypeByKey(args[arg_idx].exprType)!;
        if (
            arg_type.kind == ValueTypeKind.CLOSURECONTEXT ||
            arg_type.kind == ValueTypeKind.EMPTY
        ) {
            arg_idx++;
            continue;
        }
        guess.guessType(temp_type, arg_type);
        temp_idx++;
        arg_idx++;
    }

    guess.guessType(
        func_type.returnType,
        context.findValueTypeByKey(ret_type)!,
    );

    return guess.typeArgs;
}

function buildCallExpression(
    expr: CallExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    let func = buildExpression(expr.callExpr, context);
    context.popReference();
    if (func instanceof ToStringValue) {
        return func;
    }
    if (func.kind === SemanticsValueKind.DYNAMIC_GET) {
        const p = func as MemberGetValue;
        if (
            p.type.kind != ValueTypeKind.FUNCTION &&
            p.type.kind != ValueTypeKind.ANY
        ) {
            throw Error(`Property Access Result is not a function`);
        }

        const f_type =
            p.type.kind == ValueTypeKind.ANY
                ? (GetPredefinedType(
                      PredefinedTypeId.FUNC_ANY_ARRAY_ANY_DEFAULT,
                  ) as FunctionType)
                : (p.type as FunctionType);
        const new_func = createMemberCallValue(p, f_type);
        if (new_func) func = new_func;
        /* Workaround: console.log's type is wrong */
        //(func as MemberCallValue).funcType = f_type;
    } else if (func.kind == SemanticsValueKind.SUPER) {
        // create the super call
        const super_value = func as SuperValue;
        const ctr = getClassContructorType(super_value.type as ObjectType);
        func = new ConstructorCallValue(
            super_value,
            ctr,
            ctr.type as FunctionType,
        );
    } else if (func.type.kind == ValueTypeKind.FUNCTION) {
        if (func instanceof VarValue) {
            const f_type = func.type as FunctionType;
            if (func.ref instanceof FunctionDeclareNode) {
                func = new FunctionCallValue(f_type.returnType, func, f_type);
            } else if (func.ref instanceof VarDeclareNode) {
                func = new ClosureCallValue(f_type.returnType, func, f_type);
            }
        } else if (func instanceof OffsetGetValue) {
            const f_type = func.type as FunctionType;
            func = new ClosureCallValue(f_type.returnType, func, f_type);
        } else {
            // We have already created call node during processing PropertyAccessExpression
            if (
                expr.callExpr.expressionKind !==
                ts.SyntaxKind.PropertyAccessExpression
            ) {
                const f_type = func.type as FunctionType;
                func = new ClosureCallValue(f_type.returnType, func, f_type);
            }
        }
    } else if (
        func instanceof VarValue &&
        (func.type.kind === ValueTypeKind.ANY ||
            func.type.kind === ValueTypeKind.UNION)
    ) {
        /* any value's functype can not be ensure, return value type will always be any  */
        let parameters: SemanticsValue[] | undefined = undefined;
        if (expr.callArgs.length > 0) {
            parameters = buildParameters(context, expr.callArgs);
        }
        return new AnyCallValue(Primitive.Any, func, parameters);
    } else if (!isMemberCallValue(func.kind)) {
        throw Error(
            `unkown type for function call func kind: ${
                SemanticsValueKind[func.kind]
            }`,
        );
    }

    let func_type = (func as FunctionCallBaseValue).funcType;

    if (expr.typeArguments || func_type.typeArguments) {
        let specialTypeArgs: ValueType[];
        if (expr.typeArguments) {
            specialTypeArgs = buildTypeArguments(context, expr.typeArguments!);
        } else {
            // specialize the typeArguments by callArgs and return type
            specialTypeArgs = specializeFuncTypeArgumentsByArgs(
                context,
                func_type,
                expr.callArgs,
                expr.exprType,
            );
        }
        func_type = updateValueTypeByTypeArguments(
            func_type,
            specialTypeArgs,
        ) as FunctionType;
        (func as FunctionCallBaseValue).funcType = func_type;
    }

    // process the arguments
    if (expr.callArgs.length > 0) {
        (func as FunctionCallBaseValue).parameters = buildParameters(
            context,
            expr.callArgs,
            func_type,
        );
    }
    context.popReference();

    if (!func.shape) {
        func.shape = GetShapeFromType(func_type.returnType);
    }
    func.type = func_type.returnType; // reset the func type
    func.shape = GetShapeFromType(func.type);
    return func;
}

function buildEnumerateKeysExpr(
    expr: EnumerateKeysExpression,
    context: BuildContext,
) {
    const valueType = context.findValueTypeByKey(expr.exprType)!;
    context.pushReference(ValueReferenceKind.RIGHT);
    const obj = buildExpression(expr.targetObj, context);
    context.popReference();

    return new EnumerateKeysGetValue(valueType, obj);
}

function buildNewExpression2(
    expr: NewExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    let class_value = buildExpression(expr.newExpr, context);
    context.popReference();

    const type = class_value.effectType;
    if (!(type instanceof ObjectType)) {
        throw Error(`${class_value} is not a class or class interface`);
    }

    let valueTypeArgs: ValueType[] | undefined = undefined;

    if (expr.typeArguments) {
        valueTypeArgs = buildTypeArguments(context, expr.typeArguments);
    }

    let object_type = type as ObjectType;
    if (object_type.instanceType) object_type = object_type.instanceType;
    if (expr.typeArguments) {
        // handle array specialization
        if (object_type.kind == ValueTypeKind.ARRAY) {
            object_type = updateValueTypeByTypeArguments(
                object_type,
                valueTypeArgs!,
            ) as ObjectType;
        } else {
            const exprObjType = context.module.findValueTypeByType(
                expr.exprType,
            )! as ObjectType;
            if (
                exprObjType &&
                exprObjType.genericOwner &&
                exprObjType.genericType.equals(object_type)
            ) {
                class_value = context.getGlobalValue(exprObjType.meta.name)!;
                object_type = exprObjType;
            }
        }
    }
    const clazz_type = object_type.classType;

    if (clazz_type && clazz_type.kind == ValueTypeKind.ARRAY) {
        if (expr.lenExpr != null) {
            const lenExpr = buildExpression(expr.lenExpr!, context);
            const object_value = new NewArrayLenValue(
                object_type as ArrayType,
                lenExpr,
            );
            if (valueTypeArgs) object_value.setTypeArguments(valueTypeArgs);
            return object_value;
        } else {
            return buildNewArrayParameters(
                context,
                object_type as ArrayType,
                expr.newArgs,
                valueTypeArgs,
            );
        }
    }

    if (clazz_type && clazz_type.isClassObject()) {
        return buildNewClass(
            context,
            class_value,
            clazz_type,
            expr.newArgs,
            valueTypeArgs,
        );
    } else if (!clazz_type && object_type.isObject()) {
        // new interface_value
        return buildNewInterface(
            context,
            class_value,
            object_type,
            expr.newArgs,
            valueTypeArgs,
        );
    }

    throw Error(`${class_value} is not a class or class interface`);
}

function buildNewClass(
    context: BuildContext,
    class_value: SemanticsValue,
    object_type: ObjectType,
    params: Expression[] | undefined,
    valueTypeArgs: ValueType[] | undefined,
): SemanticsValue {
    if (!object_type.isClassObject()) {
        throw Error(`${class_value} shoubld be a class: ${object_type}`);
    }

    let param_values: SemanticsValue[] = [];
    if (params && params.length > 0) {
        const class_meta = object_type.meta;
        const member_ctr = class_meta.findConstructor();
        if (!member_ctr) {
            throw Error(`${object_type} cannot found constructor`);
        }
        const value_type = member_ctr!.valueType;
        const func_type =
            value_type.kind == ValueTypeKind.FUNCTION
                ? (value_type as FunctionType)
                : undefined;
        param_values = buildParameters(context, params, func_type);
    }

    const object_value = new NewConstructorObjectValue(
        object_type.instanceType!,
        //class_value,
        param_values,
    );

    if (valueTypeArgs) object_value.setTypeArguments(valueTypeArgs);

    return object_value;
}

function buildNewArrayParameters(
    context: BuildContext,
    arr_type: ArrayType,
    params: Expression[] | undefined,
    valueTypeArgs: ValueType[] | undefined,
): SemanticsValue {
    const param_values: SemanticsValue[] = [];

    let init_types: Set<ValueType> | undefined = undefined;
    if (!arr_type.isSpecialized() && params && params.length > 0) {
        init_types = new Set<ValueType>();
    }

    if (params && params && params.length > 0) {
        for (const p of params) {
            context.pushReference(ValueReferenceKind.RIGHT);
            const v = buildExpression(p, context);
            context.popReference();
            param_values.push(v);
            if (init_types) {
                init_types.add(v.type);
            }
        }
    }

    if (init_types) {
        arr_type = createArrayType(
            context,
            CreateWideTypeFromTypes(context, init_types),
        );
    }

    if (!arr_type.isSpecialized()) {
        arr_type = GetPredefinedType(PredefinedTypeId.ARRAY_ANY)! as ArrayType;
    }

    const arr_value = new NewArrayValue(
        arr_type.instanceType! as ArrayType,
        param_values,
    );
    if (valueTypeArgs) arr_value.setTypeArguments(valueTypeArgs);
    return arr_value;
}

function buildNewInterface(
    context: BuildContext,
    class_value: SemanticsValue,
    object_type: ObjectType,
    params: Expression[] | undefined,
    valueTypeArgs: ValueType[] | undefined,
): SemanticsValue {
    const meta = object_type.meta;
    const ctr_member = meta.findConstructor();
    if (!ctr_member) {
        throw Error(`${object_type} does not have constructor`);
    }

    const func_type = ctr_member.valueType as FunctionType;
    const target_type = func_type.returnType;
    if (!target_type) {
        throw Error(
            `class_value: ${class_value} constructor: ${ctr_member} should return an object type`,
        );
    }

    if (
        target_type.kind != ValueTypeKind.OBJECT &&
        target_type.kind != ValueTypeKind.TYPE_PARAMETER
    ) {
        throw Error(`${object_type} should return an object ${func_type}`);
    }

    let param_values: SemanticsValue[] = [];
    if (params && params.length > 0) {
        param_values = buildParameters(context, params, func_type);
    }

    const obj_value = new NewFromClassObjectValue(
        target_type as ObjectType,
        class_value,
        param_values,
    );

    if (valueTypeArgs) obj_value.setTypeArguments(valueTypeArgs);
    return obj_value;
}

function buildAsExpression(
    expr: AsExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    const right = buildExpression(expr.expression, context);
    context.popReference();
    // TODO process the template type parameter
    const value_type = context.module.findValueTypeByType(expr.exprType);
    if (!value_type) {
        throw Error(
            `Unknow Type for AsExpression: ${SymbolKeyToString(expr.exprType)}`,
        );
    }

    return newCastValue(value_type, right);
}

function buildElementAccessExpression(
    expr: ElementAccessExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    const own = buildExpression(expr.accessExpr, context);
    let arg = buildExpression(expr.argExpr, context);
    context.popReference();

    const is_index =
        arg.type.kind == ValueTypeKind.NUMBER ||
        arg.type.kind == ValueTypeKind.INT;

    const ref_type = context.currentReference();
    const is_set = ref_type == ValueReferenceKind.LEFT;
    let element_type = is_set
        ? SemanticsValueKind.OBJECT_KEY_SET
        : SemanticsValueKind.OBJECT_KEY_GET;
    const type = own.effectType;
    let value_type = Primitive.Any;

    if (is_index) {
        if (
            type.kind == ValueTypeKind.STRING ||
            type.kind == ValueTypeKind.RAW_STRING
        ) {
            element_type = is_set
                ? SemanticsValueKind.STRING_INDEX_SET
                : SemanticsValueKind.STRING_INDEX_GET;
            value_type = Primitive.String;
        } else if (type.kind == ValueTypeKind.ARRAY) {
            element_type = is_set
                ? SemanticsValueKind.ARRAY_INDEX_SET
                : SemanticsValueKind.ARRAY_INDEX_GET;
            const array_type = type as ArrayType;
            value_type = array_type.element;
        } else if (type.kind == ValueTypeKind.OBJECT) {
            const obj_type = type as ObjectType;
            if (obj_type.numberIndexType) {
                value_type = obj_type.numberIndexType;
                element_type = is_set
                    ? SemanticsValueKind.OBJECT_INDEX_SET
                    : SemanticsValueKind.OBJECT_INDEX_GET;
            }
        }
    } else {
        if (type.kind == ValueTypeKind.OBJECT) {
            const obj_type = type as ObjectType;
            if (obj_type.stringIndexType) {
                value_type = obj_type.stringIndexType;
            } else {
                value_type = createType(context, expr.exprType);
            }
        }
    }

    if (type.kind == ValueTypeKind.ENUM) {
        arg = newCastValue((type as EnumType).memberType, arg);
        return new ElementGetValue(
            SemanticsValueKind.ENUM_KEY_GET,
            Primitive.String,
            own,
            arg,
        );
    }

    if (is_set) {
        return new ElementSetValue(
            element_type as ElementSetValueKind,
            value_type,
            own,
            arg,
        );
    } else {
        return new ElementGetValue(
            element_type as ElementGetValueKind,
            value_type,
            own,
            arg,
        );
    }
}

function getCurrentClassType(context: BuildContext): TSClass | undefined {
    let scope: Scope | null = context.top().scope;

    while (scope != null && scope.kind != ScopeKind.ClassScope) {
        scope = scope.parent ? scope.parent : null;
    }

    if (scope) return (scope as ClassScope).classType;

    return undefined;
}

function buildThisValue2(context: BuildContext): SemanticsValue {
    const type = getCurrentClassType(context);

    if (!type) {
        throw Error(`cannot find the this type`);
    }

    const obj_type = context.findValueType(type)! as ObjectType;

    const this_value = new ThisValue2(obj_type);
    return this_value;
}

function buildSuperValue(
    expr: SuperExpression,
    context: BuildContext,
): SemanticsValue {
    const clazz = getCurrentClassType(context);
    let param_values: SemanticsValue[] = [];

    if (!clazz) {
        throw Error('cannot find the current class type for super');
    }

    const super_class = clazz!.getBase();
    if (!super_class) {
        throw Error(`class "${clazz.mangledName}" has no super type`);
    }

    const super_type = context.findValueType(super_class!)! as ObjectType;

    const ts_node = expr.tsNode;
    if (ts_node == undefined) {
        throw Error(`cannot find the context for using super`);
    }
    const context_kind = ts_node.parent.kind;
    let isStaticFunc = false;
    if (context_kind == ts.SyntaxKind.PropertyAccessExpression) {
        const propertyName = (
            (ts_node.parent as ts.PropertyAccessExpression)
                .name as ts.Identifier
        ).escapedText;
        super_class.memberFuncs.forEach((func) => {
            if (func.name == propertyName) {
                isStaticFunc = func.type.isStatic;
            }
        });
        if (!isStaticFunc) {
            return new SuperValue(super_type, SuperUsageFlag.SUPER_LITERAL);
        } else {
            return context.findSymbolKey(super_class) as VarValue;
        }
    } else {
        if (expr.callArgs && expr.callArgs.length > 0) {
            const ctorType = super_type.meta.ctor!.valueType;
            param_values = buildParameters(
                context,
                expr.callArgs,
                ctorType as FunctionType,
            );
        }
        return new SuperValue(
            super_type,
            SuperUsageFlag.SUPER_CALL,
            param_values,
        );
    }
}

function buildSuperExpression(
    expr: SuperExpression,
    context: BuildContext,
): SemanticsValue {
    return buildSuperValue(expr, context);
}

function buildUnaryExpression(
    expr: UnaryExpression,
    context: BuildContext,
): SemanticsValue {
    context.pushReference(ValueReferenceKind.RIGHT);
    const operand = buildExpression(expr.operand, context);
    context.popReference();

    let flattenExprValue: SemanticsValue | undefined;
    switch (expr.operatorKind) {
        case ts.SyntaxKind.PlusPlusToken:
        case ts.SyntaxKind.MinusMinusToken: {
            /* i++ ===> i += 1 */
            /* i-- ===> i -= 1 */
            const tmpOpKind = flattenOperator(expr.operatorKind);
            const tmpLiteralExpression = new NumberLiteralExpression(1);
            const tmpBinaryExpression = new BinaryExpression(
                tmpOpKind,
                expr.operand,
                tmpLiteralExpression,
            );
            flattenExprValue = buildBinaryExpression(
                tmpBinaryExpression,
                context,
            );
            break;
        }
        case ts.SyntaxKind.MinusToken: {
            /* -8 ==> 0-8, -a ===> 0-a */
            const tmpOpKind = flattenOperator(expr.operatorKind);
            const tmpLiteralExpression = new NumberLiteralExpression(0);
            const tmpBinaryExpression = new BinaryExpression(
                tmpOpKind,
                tmpLiteralExpression,
                expr.operand,
            );
            flattenExprValue = buildBinaryExpression(
                tmpBinaryExpression,
                context,
            );
            break;
        }
    }

    if (expr.expressionKind == ts.SyntaxKind.PrefixUnaryExpression)
        return new PrefixUnaryExprValue(
            operand.type as PrimitiveType,
            expr.operatorKind as ts.PrefixUnaryOperator,
            operand,
            flattenExprValue,
        );
    return new PostUnaryExprValue(
        operand.type as PrimitiveType,
        expr.operatorKind as ts.PostfixUnaryOperator,
        operand,
        flattenExprValue,
    );
}

export function buildFunctionExpression(
    funcScope: FunctionScope,
    context: BuildContext,
): SemanticsValue {
    const func = context.globalSymbols.get(funcScope);
    if (
        !func ||
        (!(
            func instanceof SemanticsNode &&
            (func! as SemanticsNode).kind == SemanticsKind.FUNCTION
        ) &&
            !(
                func instanceof SemanticsValue &&
                (func! as SemanticsValue).type.kind == ValueTypeKind.FUNCTION
            ))
    ) {
        throw Error(`Cannot found the function ${funcScope.funcName}`);
    }

    let func_node: FunctionDeclareNode | undefined = undefined;
    if ((func as unknown) instanceof SemanticsValue) {
        /* const func = function() { ... } */
        /* function is anonymous */
        const value = func as SemanticsValue;
        if (
            value instanceof VarValue &&
            (value as VarValue).ref instanceof FunctionDeclareNode
        ) {
            func_node = (value as VarValue).ref as FunctionDeclareNode;
        }
    } else {
        func_node = func as SemanticsNode as FunctionDeclareNode;
    }

    if (!func_node) {
        throw Error(
            `Cannot get the right function declearation from functionscope ${funcScope.funcName}, function: ${func}`,
        );
    }

    // new Closure Function
    return new NewClosureFunction(
        func_node,
        context.buildClosureInitList(func_node),
    );
}

export function buildExpression(
    expr: Expression,
    context: BuildContext,
): SemanticsValue {
    Logger.debug(
        `======= buildExpression: ${ts.SyntaxKind[expr.expressionKind]}`,
    );
    let res: SemanticsValue | null = null;
    try {
        switch (expr.expressionKind) {
            case ts.SyntaxKind.PropertyAccessExpression:
                // EnumerateKeysExpression and PropertyAccessExpression has the same type kind
                if (expr instanceof EnumerateKeysExpression) {
                    res = buildEnumerateKeysExpr(expr, context);
                } else {
                    res = buildPropertyAccessExpression(
                        expr as PropertyAccessExpression,
                        context,
                    );
                }
                break;
            case ts.SyntaxKind.Identifier:
                res = buildIdentiferExpression(
                    expr as IdentifierExpression,
                    context,
                );
                break;
            case ts.SyntaxKind.NullKeyword:
                res = new LiteralValue(Primitive.Null, null);
                break;
            case ts.SyntaxKind.UndefinedKeyword:
                res = new LiteralValue(Primitive.Undefined, undefined);
                break;
            case ts.SyntaxKind.NumericLiteral: {
                const n = (expr as NumberLiteralExpression).expressionValue;
                if (isInt(expr)) {
                    res = new LiteralValue(Primitive.Int, toInt(n));
                } else {
                    res = new LiteralValue(Primitive.Number, n);
                }
                break;
            }
            case ts.SyntaxKind.StringLiteral:
                res = new LiteralValue(
                    Primitive.RawString,
                    (expr as StringLiteralExpression).expressionValue,
                );
                break;
            case ts.SyntaxKind.TrueKeyword:
                res = new LiteralValue(Primitive.Boolean, true);
                break;
            case ts.SyntaxKind.FalseKeyword:
                res = new LiteralValue(Primitive.Boolean, false);
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                res = buildObjectLiteralExpression(
                    expr as ObjectLiteralExpression,
                    context,
                );
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                res = buildArrayLiteralExpression(
                    expr as ArrayLiteralExpression,
                    context,
                );
                break;
            case ts.SyntaxKind.BinaryExpression:
                res = buildBinaryExpression(expr as BinaryExpression, context);
                break;
            case ts.SyntaxKind.CommaToken:
                res = buildCommaExpression(expr as CommaExpression, context);
                break;
            case ts.SyntaxKind.ConditionalExpression:
                res = buildConditionalExpression(
                    expr as ConditionalExpression,
                    context,
                );
                break;
            case ts.SyntaxKind.CallExpression:
                res = buildCallExpression(expr as CallExpression, context);
                break;
            case ts.SyntaxKind.SuperKeyword:
                res = buildSuperExpression(expr as SuperExpression, context);
                break;
            case ts.SyntaxKind.ThisKeyword:
                res = buildThisValue2(context);
                break;
            case ts.SyntaxKind.NewExpression:
                res = buildNewExpression2(expr as NewExpression, context);
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                res = buildElementAccessExpression(
                    expr as ElementAccessExpression,
                    context,
                );
                break;
            case ts.SyntaxKind.AsExpression:
                res = buildAsExpression(expr as AsExpression, context);
                break;
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
                res = buildFunctionExpression(
                    (expr as FunctionExpression).funcScope,
                    context,
                );
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                res = buildExpression(
                    (expr as ParenthesizedExpression).parentesizedExpr,
                    context,
                );
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
                res = buildUnaryExpression(expr as UnaryExpression, context);
                break;
            case ts.SyntaxKind.TypeOfExpression:
                res = buildTypeOfExpression(expr as TypeOfExpression, context);
                break;
            case ts.SyntaxKind.SpreadElement: {
                const targetValue = buildExpression(
                    (expr as SpreadExpression).target,
                    context,
                );
                res = new SpreadValue(targetValue.type, targetValue);
                break;
            }
            case ts.SyntaxKind.TemplateExpression: {
                res = buildTemplateExpression(
                    expr as TemplateExpression,
                    context,
                );
                break;
            }
        }
        if (res == null) {
            res = new UnimplementValue(expr.tsNode!);
        }
        if (getConfig().sourceMap && expr.tsNode) {
            res.location = getNodeLoc(expr.tsNode);
        }
        return res;
    } catch (e: any) {
        Logger.error(e);
        const tsNode = expr.tsNode;
        /** sometimes Expression maybe convert from other Expression for convenience
         * so the tsNode maybe undefined
         */
        if (!tsNode) {
            throw Error(e);
        }
        const sourceFile = tsNode.getSourceFile();
        const start = tsNode.getStart(sourceFile);
        const startLineInfo = sourceFile.getLineAndCharacterOfPosition(start);
        Logger.error(
            `[ERROR] @ "${sourceFile.fileName}" line: ${
                startLineInfo.line + 1
            } @${
                startLineInfo.character
            }  end: ${tsNode.getEnd()}  width: ${tsNode.getWidth(sourceFile)}`,
        );
        Logger.error(`Source: ${tsNode.getFullText(sourceFile)}`);
        throw Error(e);
    }
}
