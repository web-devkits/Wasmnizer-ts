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
    EnumType,
    ObjectType,
} from './value_types.js';

import {
    createType,
    isObjectType,
    isNullValueType,
    createUnionType,
    createArrayType,
} from './type_creator.js';

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
    MemberGetValue,
    MemberSetValue,
    MemberCallValue,
    NewLiteralObjectValue,
    NewLiteralArrayValue,
    NewConstructorObjectValue,
    NewFromClassObjectValue,
    ReturnValue,
    BlockValue,
    BlockBranchValue,
    BlockBranchIfValue,
} from './value.js';

import {
    SemanticsNode,
    SemanticsKind,
    FunctionDeclareNode,
    VarDeclareNode,
    ModuleNode,
    ForNode,
    IfNode,
    BasicBlockNode,
    BlockNode,
    SwitchNode,
    CaseClauseNode,
    DefaultClauseNode,
    WhileNode,
    ReturnNode,
} from './semantics_nodes.js';

export function flattenConditionValue(
    cond: ConditionExprValue,
): SemanticsValue {
    const outter = new BlockValue(cond.falseExpr.type, 'condition_outter');
    const falseBlock = new BlockValue(cond.trueExpr.type, 'condition_false');
    const trueBlock = new BlockValue(cond.trueExpr.type, 'condition_true');

    /* TODO: flatten here may be a mistake, since binaryen don't allow return in block $condition_false, which will add a drop manually.*/
    /*
       condition ? trueExpr : FalseExpr
        block $outter
            block $condition_false
                branch_if condition false  branch $condition_false
                block $condition_true
                    trueExpr
                    end
                branch $outter
                end
            falseExpr
            end
        end
   */

    trueBlock.addValue(cond.trueExpr);

    falseBlock.addValue(
        new BlockBranchIfValue(
            new BlockBranchValue(falseBlock),
            cond.condition,
            false,
        ),
    );
    falseBlock.addValue(trueBlock);
    falseBlock.addValue(new BlockBranchValue(outter));

    outter.addValue(falseBlock);
    outter.addValue(cond.falseExpr);

    outter.shape = cond.shape;
    return outter;
}

export class FlattenContext {
    private _labelIndex = 0;

    private _stacks: BlockValue[] = [];

    push(block: BlockValue) {
        this._stacks.push(block);
    }
    pop() {
        this._stacks.pop();
    }

    addValue(value: SemanticsValue) {
        if (this._stacks.length > 0) {
            this._stacks[this._stacks.length - 1].addValue(value);
        }
    }

    pushAdd(block: BlockValue) {
        this.addValue(block);
        this.push(block);
    }

    makeLabel(hint: string): string {
        this._labelIndex++;
        return `${hint}${this._labelIndex}`;
    }

    findNearestLoop(): BlockValue | undefined {
        if (this._stacks.length <= 0) return undefined;
        let block: BlockValue | undefined =
            this._stacks[this._stacks.length - 1];
        while (block && block.isLoop) {
            block = block.parent;
        }
        return block;
    }

    findNearestBreakTarget(): BlockValue | undefined {
        if (this._stacks.length <= 0) return undefined;
        let block: BlockValue | undefined =
            this._stacks[this._stacks.length - 1];
        while (block && block.breakTarget) block = block.parent;

        return block;
    }
}

function buildVarReferenceList(
    varList?: VarDeclareNode[],
): VarDeclareNode[] | undefined {
    if (varList) {
        const vl = varList.filter((v) => v.isUsedInClosureByRef());
        if (vl.length > 0) return vl;
    }
    return undefined;
}

export function flatternStatement(
    node: SemanticsNode,
    context: FlattenContext,
) {
    switch (node.kind) {
        case SemanticsKind.BASIC_BLOCK:
            node.forEachValue((v) => context.addValue(v));
            break;
        case SemanticsKind.RETURN:
            context.addValue(new ReturnValue((node as ReturnNode).expr));
            break;
        case SemanticsKind.BREAK: {
            const breakable_block = context.findNearestLoop();
            if (breakable_block) {
                context.addValue(new BlockBranchValue(breakable_block));
            } else {
                // error
                throw Error(`break unkown block`);
            }
            break;
        }
        case SemanticsKind.CONTINUE: {
            const loop_block = context.findNearestLoop();
            if (loop_block) {
                context.addValue(new BlockBranchValue(loop_block));
            }
            break;
        }
        case SemanticsKind.BLOCK: {
            const blockNode = node as BlockNode;
            if (blockNode.varList) {
                const new_block = new BlockValue(
                    Primitive.Void,
                    context.makeLabel('block_node'),
                );
                new_block.varList = blockNode.varList;
                new_block.refList = buildVarReferenceList(blockNode.varList);
                context.pushAdd(new_block);
                node.forEachChild((n) => flatternStatement(n, context));
                context.pop();
            } else {
                node.forEachChild((n) => flatternStatement(n, context));
            }
            break;
        }
        case SemanticsKind.IF: {
            const ifNode = node as IfNode;
            const if_block = new BlockValue(
                Primitive.Void,
                context.makeLabel('if'),
            );
            const true_block = new BlockValue(
                Primitive.Void,
                context.makeLabel('if_true'),
            );
            context.pushAdd(if_block);
            if (ifNode.falseNode) {
                /*
                 *  if (condition) { trueNode } else { falseNode }
                 *
                 *  block $if
                 *    block $if_false
                 *        branch_if condition false branch $if_false
                 *        trueNode
                 *        branch $if
                 *      end
                 *      falseNode
                 *   end
                 *  end
                 */
                const false_block = new BlockValue(
                    Primitive.Void,
                    context.makeLabel('if_false'),
                );
                true_block.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(false_block),
                        ifNode.condition,
                        false,
                    ),
                );
                context.push(true_block);
                flatternStatement(ifNode.trueNode, context);
                context.pop();
                true_block.addValue(new BlockBranchValue(if_block));
                false_block.addValue(true_block);
                context.push(false_block);
                flatternStatement(ifNode.falseNode, context);
                context.pop();
                if_block.addValue(false_block);
            } else {
                /*
                 *  if (condition) { trueNode }
                 *
                 *  block $if
                 *      branch_if condition false branch $if
                 *      trueNode
                 *   end
                 * end
                 */
                true_block.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(if_block),
                        ifNode.condition,
                        false,
                    ),
                );
                context.push(true_block);
                flatternStatement(ifNode.trueNode, context);
                context.pop();
                if_block.addValue(true_block);
            }
            context.pop();
            break;
        }
        case SemanticsKind.WHILE:
        /* falls through */
        case SemanticsKind.DOWHILE: {
            /*  while(condition) { body }
            block $while
                loop $while_loop
                   branch_if condition false $while
                   body
                   branch $while_loop // loop
                end  // while loop
            end

            do { body } while(condition)

            block $do_while
              loop $do_while_loop
                 body
                 branch_if condition true $do_while_loop
                 branch $do_while
              end
            end
          */
            const whileNode = node as WhileNode;
            const is_dowhile = node.kind == SemanticsKind.DOWHILE;
            const hint_prefix = is_dowhile ? 'do_while' : 'while';
            const while_block = new BlockValue(
                Primitive.Void,
                hint_prefix,
                false,
                true,
            );
            const loop_block = new BlockValue(
                Primitive.Void,
                context.makeLabel(`${hint_prefix}_loop`),
                true,
            );
            context.pushAdd(while_block);
            context.pushAdd(loop_block);
            if (is_dowhile) {
                if (whileNode.body) {
                    flatternStatement(whileNode.body, context);
                }
                loop_block.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(loop_block),
                        whileNode.condition,
                        true,
                    ),
                );
                loop_block.addValue(new BlockBranchValue(while_block));
            } else {
                loop_block.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(while_block),
                        whileNode.condition,
                        false,
                    ),
                );
                if (whileNode.body) flatternStatement(whileNode.body, context);
                loop_block.addValue(new BlockBranchValue(loop_block));
            }
            context.pop();
            context.pop();
            break;
        }

        case SemanticsKind.FOR: {
            /*
           for (initialize; condition; next) { body }

           block $for
               initialize
               loop  $for_loop
                 branch_if condition false $for
                 block $for_body
                    body   // for continue to break to loop
                 end
                 next
                 branch $for_loop
               end
           end
         */
            const forNode = node as ForNode;
            const for_block = new BlockValue(
                Primitive.Void,
                context.makeLabel('for'),
                false,
                true,
            );
            context.pushAdd(for_block);
            const for_loop = new BlockValue(
                Primitive.Void,
                context.makeLabel('for_loop'),
                true,
            );
            if (forNode.varList) {
                for_block.varList = forNode.varList;
                for_block.refList = buildVarReferenceList(forNode.varList);
            }
            if (forNode.initialize)
                flatternStatement(forNode.initialize, context);

            context.pushAdd(for_loop);
            if (forNode.condition) {
                for_loop.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(for_block),
                        forNode.condition,
                        false,
                    ),
                );
            }
            if (forNode.body) {
                const body_block = new BlockValue(
                    Primitive.Void,
                    context.makeLabel('for_body'),
                );
                context.pushAdd(body_block);
                flatternStatement(forNode.body, context);
                context.pop();
            }
            if (forNode.next) for_loop.addValue(forNode.next);
            // add loop
            for_loop.addValue(new BlockBranchValue(for_loop));
            context.pop();
            context.pop();
            break;
        }

        case SemanticsKind.SWITCH: {
            const switchNode = node as SwitchNode;
            /*
           switch(condition) { caseClause .. defaultClause }
           block $switch
             block $switch_default
                 block $switch_caseN
                    block $switch_caseN-1
                       block $switch_caseN-2
                          ...
                            block $switch_case1
                              branch_if case1_condition false $blcok $switch_case2
                              case1_body
                              branch $switch
                            end
                            branch_if case2_condition false $block $switch_case3
                            case2_body
                            breach $switch
                            ...
                       end
                    end
                 end
             end
           end
         */
            const switch_block = new BlockValue(
                Primitive.Void,
                context.makeLabel('switch'),
                false,
                true,
            );
            context.pushAdd(switch_block);
            if (switchNode.defaultClause) {
                const def_block = new BlockValue(
                    Primitive.Void,
                    context.makeLabel('switch_default'),
                );
                context.pushAdd(def_block);
                if (switchNode.defaultClause.body)
                    flatternStatement(switchNode.defaultClause.body, context);
            }
            for (let i = switchNode.caseClause.length - 1; i >= 0; i--) {
                const case_node = switchNode.caseClause[i];
                const case_block = new BlockValue(
                    Primitive.Void,
                    context.makeLabel(`switch_case${i}_`),
                );
                context.pushAdd(case_block);
                context.addValue(
                    new BlockBranchIfValue(
                        new BlockBranchValue(case_block.parent!),
                        case_node.caseVar,
                        false,
                    ),
                );
                if (case_node.body) flatternStatement(case_node.body, context);
                context.pop();
            }

            if (switchNode.defaultClause) {
                context.pop();
            }
            context.pop();
            break;
        }
        case SemanticsKind.FOR_IN:
        /* falls through */
        case SemanticsKind.FOR_OF:
            /*
            for (const key in/of target) body

            block $for
              varList (key)
              get_key_iter/get_value_iter
              loop $for_loop
                 branch_if it_is_null false $for
                 key = it.next
                 body
                 branch $for_loop
              end
            end
         */

            break;
    }
}

export function flattenFunction(func: FunctionDeclareNode) {
    if (func.body) {
        const context = new FlattenContext();
        const block = new BlockValue(Primitive.Void, '');
        context.push(block);
        block.varList = func.varList;
        const refList = buildVarReferenceList(block.varList);
        const paramRefList = buildVarReferenceList(func.parameters);
        if (refList && paramRefList)
            block.refList = paramRefList.concat(refList);
        else if (refList) block.refList = refList;
        else if (paramRefList) block.refList = paramRefList;

        flatternStatement(func.body, context);
        context.pop();
        func.flattenValue = block;
    }
}
