/*
 * Copyright (C) 2023 Xiaomi Corporation.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
 */

import ts from 'typescript';

export function operatorString(kind: ts.BinaryOperator) {
    switch (kind) {
        case ts.SyntaxKind.FirstAssignment:
            return '=';
        case ts.SyntaxKind.PlusEqualsToken:
            return '+=';
        case ts.SyntaxKind.MinusEqualsToken:
            return '-=';
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
            return '**=';
        case ts.SyntaxKind.AsteriskEqualsToken:
            return '*=';
        case ts.SyntaxKind.SlashEqualsToken:
            return '/=';
        case ts.SyntaxKind.PercentEqualsToken:
            return '%=';
        case ts.SyntaxKind.AmpersandEqualsToken:
            return '&=';
        case ts.SyntaxKind.BarEqualsToken:
            return '|=';
        case ts.SyntaxKind.CaretEqualsToken:
            return '^=';
        case ts.SyntaxKind.LessThanLessThanEqualsToken:
            return '<<=';
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            return '>>>=';
        case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
            return '>>=';
        case ts.SyntaxKind.AsteriskAsteriskToken:
            return '**';
        case ts.SyntaxKind.AsteriskToken:
            return '*';
        case ts.SyntaxKind.SlashToken:
            return '/';
        case ts.SyntaxKind.PercentToken:
            return '%';
        case ts.SyntaxKind.PlusToken:
            return '+';
        case ts.SyntaxKind.MinusToken:
            return '-';
        case ts.SyntaxKind.CommaToken:
            return ',';
        case ts.SyntaxKind.LessThanLessThanToken:
            return '<<';
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
            return '>>';
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
            return '<<<';
        case ts.SyntaxKind.LessThanToken:
            return '<';
        case ts.SyntaxKind.LessThanEqualsToken:
            return '<=';
        case ts.SyntaxKind.GreaterThanToken:
            return '>';
        case ts.SyntaxKind.GreaterThanEqualsToken:
            return '>=';
        case ts.SyntaxKind.InstanceOfKeyword:
            return 'instance of';
        case ts.SyntaxKind.InKeyword:
            return 'in';
        case ts.SyntaxKind.EqualsEqualsToken:
            return '==';
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            return '===';
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            return '!==';
        case ts.SyntaxKind.ExclamationEqualsToken:
            return '!=';
        case ts.SyntaxKind.AmpersandToken:
            return '&';
        case ts.SyntaxKind.BarToken:
            return '|';
        case ts.SyntaxKind.CaretToken:
            return '^';
        case ts.SyntaxKind.AmpersandAmpersandToken:
            return '&&';
        case ts.SyntaxKind.BarBarToken:
            return '||';
        case ts.SyntaxKind.QuestionQuestionToken:
            return '??';
    }
    return ts.SyntaxKind[kind];
}

export function nodeToString(node: ts.Node): string {
    let s = ts.SyntaxKind[node.kind];
    switch (node.kind) {
        case ts.SyntaxKind.Unknown:
            break;
        case ts.SyntaxKind.EndOfFileToken:
            break;
        case ts.SyntaxKind.SingleLineCommentTrivia:
            break;
        case ts.SyntaxKind.MultiLineCommentTrivia:
            break;
        case ts.SyntaxKind.NewLineTrivia:
            break;
        case ts.SyntaxKind.WhitespaceTrivia:
            break;
        case ts.SyntaxKind.ShebangTrivia:
            break;
        case ts.SyntaxKind.ConflictMarkerTrivia:
            break;
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.BigIntLiteral:
        case ts.SyntaxKind.StringLiteral:
            s = s + ' "' + (node as ts.LiteralExpression).text + '"';
            break;
        case ts.SyntaxKind.JsxText:
            break;
        case ts.SyntaxKind.JsxTextAllWhiteSpaces:
            break;
        case ts.SyntaxKind.RegularExpressionLiteral:
            break;
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            break;
        case ts.SyntaxKind.TemplateHead:
        case ts.SyntaxKind.TemplateMiddle:
        case ts.SyntaxKind.TemplateTail:
            s = s + ' "' + (node as ts.LiteralLikeNode).text + '"';
            break;
        case ts.SyntaxKind.OpenBraceToken:
            break;
        case ts.SyntaxKind.CloseBraceToken:
            break;
        case ts.SyntaxKind.OpenParenToken:
            break;
        case ts.SyntaxKind.CloseParenToken:
            break;
        case ts.SyntaxKind.OpenBracketToken:
            break;
        case ts.SyntaxKind.CloseBracketToken:
            break;
        case ts.SyntaxKind.DotToken:
            break;
        case ts.SyntaxKind.DotDotDotToken:
            break;
        case ts.SyntaxKind.SemicolonToken:
            break;
        case ts.SyntaxKind.CommaToken:
            break;
        case ts.SyntaxKind.QuestionDotToken:
            break;
        case ts.SyntaxKind.LessThanToken:
            break;
        case ts.SyntaxKind.LessThanSlashToken:
            break;
        case ts.SyntaxKind.GreaterThanToken:
            break;
        case ts.SyntaxKind.LessThanEqualsToken:
            break;
        case ts.SyntaxKind.GreaterThanEqualsToken:
            break;
        case ts.SyntaxKind.EqualsEqualsToken:
            break;
        case ts.SyntaxKind.ExclamationEqualsToken:
            break;
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            break;
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            break;
        case ts.SyntaxKind.EqualsGreaterThanToken:
            break;
        case ts.SyntaxKind.PlusToken:
            break;
        case ts.SyntaxKind.MinusToken:
            break;
        case ts.SyntaxKind.AsteriskToken:
            break;
        case ts.SyntaxKind.AsteriskAsteriskToken:
            break;
        case ts.SyntaxKind.SlashToken:
            break;
        case ts.SyntaxKind.PercentToken:
            break;
        case ts.SyntaxKind.PlusPlusToken:
            break;
        case ts.SyntaxKind.MinusMinusToken:
            break;
        case ts.SyntaxKind.LessThanLessThanToken:
            break;
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
            break;
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
            break;
        case ts.SyntaxKind.AmpersandToken:
            break;
        case ts.SyntaxKind.BarToken:
            break;
        case ts.SyntaxKind.CaretToken:
            break;
        case ts.SyntaxKind.ExclamationToken:
            break;
        case ts.SyntaxKind.TildeToken:
            break;
        case ts.SyntaxKind.AmpersandAmpersandToken:
            break;
        case ts.SyntaxKind.BarBarToken:
            break;
        case ts.SyntaxKind.QuestionToken:
            break;
        case ts.SyntaxKind.ColonToken:
            break;
        case ts.SyntaxKind.AtToken:
            break;
        case ts.SyntaxKind.QuestionQuestionToken:
            break;
        /** Only the JSDoc scanner produces BacktickToken. The normal scanner produces NoSubstitutionTemplateLiteral and related kinds. */
        case ts.SyntaxKind.BacktickToken:
            break;
        case ts.SyntaxKind.EqualsToken:
            s = s + ' ' + operatorString(node.kind);
            break;
        case ts.SyntaxKind.PlusEqualsToken:
            break;
        case ts.SyntaxKind.MinusEqualsToken:
            break;
        case ts.SyntaxKind.AsteriskEqualsToken:
            break;
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
            break;
        case ts.SyntaxKind.SlashEqualsToken:
            break;
        case ts.SyntaxKind.PercentEqualsToken:
            break;
        case ts.SyntaxKind.LessThanLessThanEqualsToken:
            break;
        case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
            break;
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            break;
        case ts.SyntaxKind.AmpersandEqualsToken:
            break;
        case ts.SyntaxKind.BarEqualsToken:
            break;
        case ts.SyntaxKind.CaretEqualsToken:
            break;
        case ts.SyntaxKind.Identifier:
            s = s + " '" + (node as ts.Identifier).escapedText + "'";
            break;
        case ts.SyntaxKind.PrivateIdentifier:
            break;
        case ts.SyntaxKind.BreakKeyword:
            break;
        case ts.SyntaxKind.CaseKeyword:
            break;
        case ts.SyntaxKind.CatchKeyword:
            break;
        case ts.SyntaxKind.ClassKeyword:
            break;
        case ts.SyntaxKind.ConstKeyword:
            break;
        case ts.SyntaxKind.ContinueKeyword:
            break;
        case ts.SyntaxKind.DebuggerKeyword:
            break;
        case ts.SyntaxKind.DefaultKeyword:
            break;
        case ts.SyntaxKind.DeleteKeyword:
            break;
        case ts.SyntaxKind.DoKeyword:
            break;
        case ts.SyntaxKind.ElseKeyword:
            break;
        case ts.SyntaxKind.EnumKeyword:
            break;
        case ts.SyntaxKind.ExportKeyword:
            break;
        case ts.SyntaxKind.ExtendsKeyword:
            break;
        case ts.SyntaxKind.FalseKeyword:
            break;
        case ts.SyntaxKind.FinallyKeyword:
            break;
        case ts.SyntaxKind.ForKeyword:
            break;
        case ts.SyntaxKind.FunctionKeyword:
            break;
        case ts.SyntaxKind.IfKeyword:
            break;
        case ts.SyntaxKind.ImportKeyword:
            break;
        case ts.SyntaxKind.InKeyword:
            break;
        case ts.SyntaxKind.InstanceOfKeyword:
            break;
        case ts.SyntaxKind.NewKeyword:
            break;
        case ts.SyntaxKind.NullKeyword:
            break;
        case ts.SyntaxKind.ReturnKeyword:
            break;
        case ts.SyntaxKind.SuperKeyword:
            break;
        case ts.SyntaxKind.SwitchKeyword:
            break;
        case ts.SyntaxKind.ThisKeyword:
            break;
        case ts.SyntaxKind.ThrowKeyword:
            break;
        case ts.SyntaxKind.TrueKeyword:
            break;
        case ts.SyntaxKind.TryKeyword:
            break;
        case ts.SyntaxKind.TypeOfKeyword:
            break;
        case ts.SyntaxKind.VarKeyword:
            break;
        case ts.SyntaxKind.VoidKeyword:
            break;
        case ts.SyntaxKind.WhileKeyword:
            break;
        case ts.SyntaxKind.WithKeyword:
            break;
        case ts.SyntaxKind.ImplementsKeyword:
            break;
        case ts.SyntaxKind.InterfaceKeyword:
            break;
        case ts.SyntaxKind.LetKeyword:
            break;
        case ts.SyntaxKind.PackageKeyword:
            break;
        case ts.SyntaxKind.PrivateKeyword:
            break;
        case ts.SyntaxKind.ProtectedKeyword:
            break;
        case ts.SyntaxKind.PublicKeyword:
            break;
        case ts.SyntaxKind.StaticKeyword:
            break;
        case ts.SyntaxKind.YieldKeyword:
            break;
        case ts.SyntaxKind.AbstractKeyword:
            break;
        case ts.SyntaxKind.AsKeyword:
            break;
        case ts.SyntaxKind.AssertsKeyword:
            break;
        case ts.SyntaxKind.AnyKeyword:
            break;
        case ts.SyntaxKind.AsyncKeyword:
            break;
        case ts.SyntaxKind.AwaitKeyword:
            break;
        case ts.SyntaxKind.BooleanKeyword:
            break;
        case ts.SyntaxKind.ConstructorKeyword:
            break;
        case ts.SyntaxKind.DeclareKeyword:
            break;
        case ts.SyntaxKind.GetKeyword:
            break;
        case ts.SyntaxKind.InferKeyword:
            break;
        case ts.SyntaxKind.IsKeyword:
            break;
        case ts.SyntaxKind.KeyOfKeyword:
            break;
        case ts.SyntaxKind.ModuleKeyword:
            break;
        case ts.SyntaxKind.NamespaceKeyword:
            break;
        case ts.SyntaxKind.NeverKeyword:
            break;
        case ts.SyntaxKind.ReadonlyKeyword:
            break;
        case ts.SyntaxKind.RequireKeyword:
            break;
        case ts.SyntaxKind.NumberKeyword:
            break;
        case ts.SyntaxKind.ObjectKeyword:
            break;
        case ts.SyntaxKind.SetKeyword:
            break;
        case ts.SyntaxKind.StringKeyword:
            break;
        case ts.SyntaxKind.SymbolKeyword:
            break;
        case ts.SyntaxKind.TypeKeyword:
            break;
        case ts.SyntaxKind.UndefinedKeyword:
            break;
        case ts.SyntaxKind.UniqueKeyword:
            break;
        case ts.SyntaxKind.UnknownKeyword:
            break;
        case ts.SyntaxKind.FromKeyword:
            break;
        case ts.SyntaxKind.GlobalKeyword:
            break;
        case ts.SyntaxKind.BigIntKeyword:
            break;
        case ts.SyntaxKind.OfKeyword:
            break;
        case ts.SyntaxKind.QualifiedName:
            break;
        case ts.SyntaxKind.ComputedPropertyName:
            break;
        case ts.SyntaxKind.TypeParameter:
            break;
        case ts.SyntaxKind.Parameter:
            break;
        case ts.SyntaxKind.Decorator:
            break;
        case ts.SyntaxKind.PropertySignature:
            break;
        case ts.SyntaxKind.PropertyDeclaration:
            break;
        case ts.SyntaxKind.MethodSignature:
            break;
        case ts.SyntaxKind.MethodDeclaration:
            break;
        case ts.SyntaxKind.Constructor:
            break;
        case ts.SyntaxKind.GetAccessor:
            break;
        case ts.SyntaxKind.SetAccessor:
            break;
        case ts.SyntaxKind.CallSignature:
            break;
        case ts.SyntaxKind.ConstructSignature:
            break;
        case ts.SyntaxKind.IndexSignature:
            break;
        case ts.SyntaxKind.TypePredicate:
            break;
        case ts.SyntaxKind.TypeReference:
            break;
        case ts.SyntaxKind.FunctionType:
            break;
        case ts.SyntaxKind.ConstructorType:
            break;
        case ts.SyntaxKind.TypeQuery:
            break;
        case ts.SyntaxKind.TypeLiteral:
            break;
        case ts.SyntaxKind.ArrayType:
            break;
        case ts.SyntaxKind.TupleType:
            break;
        case ts.SyntaxKind.OptionalType:
            break;
        case ts.SyntaxKind.RestType:
            break;
        case ts.SyntaxKind.UnionType:
            break;
        case ts.SyntaxKind.IntersectionType:
            break;
        case ts.SyntaxKind.ConditionalType:
            break;
        case ts.SyntaxKind.InferType:
            break;
        case ts.SyntaxKind.ParenthesizedType:
            break;
        case ts.SyntaxKind.ThisType:
            break;
        case ts.SyntaxKind.TypeOperator:
            break;
        case ts.SyntaxKind.IndexedAccessType:
            break;
        case ts.SyntaxKind.MappedType:
            break;
        case ts.SyntaxKind.LiteralType:
            break;
        case ts.SyntaxKind.ImportType:
            break;
        case ts.SyntaxKind.ObjectBindingPattern:
            break;
        case ts.SyntaxKind.ArrayBindingPattern:
            break;
        case ts.SyntaxKind.BindingElement:
            break;
        case ts.SyntaxKind.ArrayLiteralExpression:
            break;
        case ts.SyntaxKind.ObjectLiteralExpression:
            break;
        case ts.SyntaxKind.PropertyAccessExpression:
            break;
        case ts.SyntaxKind.ElementAccessExpression:
            break;
        case ts.SyntaxKind.CallExpression:
            break;
        case ts.SyntaxKind.NewExpression:
            break;
        case ts.SyntaxKind.TaggedTemplateExpression:
            break;
        case ts.SyntaxKind.TypeAssertionExpression:
            break;
        case ts.SyntaxKind.ParenthesizedExpression:
            break;
        case ts.SyntaxKind.FunctionExpression:
            break;
        case ts.SyntaxKind.ArrowFunction:
            break;
        case ts.SyntaxKind.DeleteExpression:
            break;
        case ts.SyntaxKind.TypeOfExpression:
            break;
        case ts.SyntaxKind.VoidExpression:
            break;
        case ts.SyntaxKind.AwaitExpression:
            break;
        case ts.SyntaxKind.PrefixUnaryExpression:
            break;
        case ts.SyntaxKind.PostfixUnaryExpression:
            break;
        case ts.SyntaxKind.BinaryExpression:
            s =
                s +
                " operator:'" +
                operatorString(
                    (node as ts.BinaryExpression).operatorToken.kind,
                ) +
                "'";
            break;
        case ts.SyntaxKind.ConditionalExpression:
            break;
        case ts.SyntaxKind.TemplateExpression:
            break;
        case ts.SyntaxKind.YieldExpression:
            break;
        case ts.SyntaxKind.SpreadElement:
            break;
        case ts.SyntaxKind.ClassExpression:
            break;
        case ts.SyntaxKind.OmittedExpression:
            break;
        case ts.SyntaxKind.ExpressionWithTypeArguments:
            break;
        case ts.SyntaxKind.AsExpression:
            break;
        case ts.SyntaxKind.NonNullExpression:
            break;
        case ts.SyntaxKind.MetaProperty:
            break;
        case ts.SyntaxKind.SyntheticExpression:
            break;
        case ts.SyntaxKind.TemplateSpan:
            break;
        case ts.SyntaxKind.SemicolonClassElement:
            break;
        case ts.SyntaxKind.Block:
            break;
        case ts.SyntaxKind.EmptyStatement:
            break;
        case ts.SyntaxKind.VariableStatement:
            s = 'VariableStatement';
            break;
        case ts.SyntaxKind.ExpressionStatement:
            break;
        case ts.SyntaxKind.IfStatement:
            break;
        case ts.SyntaxKind.DoStatement:
            break;
        case ts.SyntaxKind.WhileStatement:
            break;
        case ts.SyntaxKind.ForStatement:
            break;
        case ts.SyntaxKind.ForInStatement:
            break;
        case ts.SyntaxKind.ForOfStatement:
            break;
        case ts.SyntaxKind.ContinueStatement:
            break;
        case ts.SyntaxKind.BreakStatement:
            break;
        case ts.SyntaxKind.ReturnStatement:
            break;
        case ts.SyntaxKind.WithStatement:
            break;
        case ts.SyntaxKind.SwitchStatement:
            break;
        case ts.SyntaxKind.LabeledStatement:
            break;
        case ts.SyntaxKind.ThrowStatement:
            break;
        case ts.SyntaxKind.TryStatement:
            break;
        case ts.SyntaxKind.DebuggerStatement:
            break;
        case ts.SyntaxKind.VariableDeclaration:
            break;
        case ts.SyntaxKind.VariableDeclarationList:
            break;
        case ts.SyntaxKind.FunctionDeclaration:
            break;
        case ts.SyntaxKind.ClassDeclaration:
            break;
        case ts.SyntaxKind.InterfaceDeclaration:
            break;
        case ts.SyntaxKind.TypeAliasDeclaration:
            break;
        case ts.SyntaxKind.EnumDeclaration:
            break;
        case ts.SyntaxKind.ModuleDeclaration:
            break;
        case ts.SyntaxKind.ModuleBlock:
            break;
        case ts.SyntaxKind.CaseBlock:
            break;
        case ts.SyntaxKind.NamespaceExportDeclaration:
            break;
        case ts.SyntaxKind.ImportEqualsDeclaration:
            break;
        case ts.SyntaxKind.ImportDeclaration:
            break;
        case ts.SyntaxKind.ImportClause:
            break;
        case ts.SyntaxKind.NamespaceImport:
            break;
        case ts.SyntaxKind.NamedImports:
            break;
        case ts.SyntaxKind.ImportSpecifier:
            break;
        case ts.SyntaxKind.ExportAssignment:
            break;
        case ts.SyntaxKind.ExportDeclaration:
            break;
        case ts.SyntaxKind.NamedExports:
            break;
        case ts.SyntaxKind.NamespaceExport:
            break;
        case ts.SyntaxKind.ExportSpecifier:
            break;
        case ts.SyntaxKind.MissingDeclaration:
            break;
        case ts.SyntaxKind.ExternalModuleReference:
            break;
        case ts.SyntaxKind.JsxElement:
            break;
        case ts.SyntaxKind.JsxSelfClosingElement:
            break;
        case ts.SyntaxKind.JsxOpeningElement:
            break;
        case ts.SyntaxKind.JsxClosingElement:
            break;
        case ts.SyntaxKind.JsxFragment:
            break;
        case ts.SyntaxKind.JsxOpeningFragment:
            break;
        case ts.SyntaxKind.JsxClosingFragment:
            break;
        case ts.SyntaxKind.JsxAttribute:
            break;
        case ts.SyntaxKind.JsxAttributes:
            break;
        case ts.SyntaxKind.JsxSpreadAttribute:
            break;
        case ts.SyntaxKind.JsxExpression:
            break;
        case ts.SyntaxKind.CaseClause:
            break;
        case ts.SyntaxKind.DefaultClause:
            break;
        case ts.SyntaxKind.HeritageClause:
            break;
        case ts.SyntaxKind.CatchClause:
            break;
        case ts.SyntaxKind.PropertyAssignment:
            break;
        case ts.SyntaxKind.ShorthandPropertyAssignment:
            break;
        case ts.SyntaxKind.SpreadAssignment:
            break;
        case ts.SyntaxKind.EnumMember:
            break;
        case ts.SyntaxKind.UnparsedPrologue:
            break;
        case ts.SyntaxKind.UnparsedPrepend:
            break;
        case ts.SyntaxKind.UnparsedText:
            break;
        case ts.SyntaxKind.UnparsedInternalText:
            break;
        case ts.SyntaxKind.UnparsedSyntheticReference:
            break;
        case ts.SyntaxKind.SourceFile:
            break;
        case ts.SyntaxKind.Bundle:
            break;
        case ts.SyntaxKind.UnparsedSource:
            break;
        case ts.SyntaxKind.InputFiles:
            break;
        case ts.SyntaxKind.JSDocTypeExpression:
            break;
        case ts.SyntaxKind.JSDocAllType:
            break;
        case ts.SyntaxKind.JSDocUnknownType:
            break;
        case ts.SyntaxKind.JSDocNullableType:
            break;
        case ts.SyntaxKind.JSDocNonNullableType:
            break;
        case ts.SyntaxKind.JSDocOptionalType:
            break;
        case ts.SyntaxKind.JSDocFunctionType:
            break;
        case ts.SyntaxKind.JSDocVariadicType:
            break;
        case ts.SyntaxKind.JSDocNamepathType:
            break;
        case ts.SyntaxKind.JSDocComment:
            break;
        case ts.SyntaxKind.JSDocTypeLiteral:
            break;
        case ts.SyntaxKind.JSDocSignature:
            break;
        case ts.SyntaxKind.JSDocTag:
            break;
        case ts.SyntaxKind.JSDocAugmentsTag:
            break;
        case ts.SyntaxKind.JSDocImplementsTag:
            break;
        case ts.SyntaxKind.JSDocAuthorTag:
            break;
        case ts.SyntaxKind.JSDocClassTag:
            break;
        case ts.SyntaxKind.JSDocPublicTag:
            break;
        case ts.SyntaxKind.JSDocPrivateTag:
            break;
        case ts.SyntaxKind.JSDocProtectedTag:
            break;
        case ts.SyntaxKind.JSDocReadonlyTag:
            break;
        case ts.SyntaxKind.JSDocCallbackTag:
            break;
        case ts.SyntaxKind.JSDocEnumTag:
            break;
        case ts.SyntaxKind.JSDocParameterTag:
            break;
        case ts.SyntaxKind.JSDocReturnTag:
            break;
        case ts.SyntaxKind.JSDocThisTag:
            break;
        case ts.SyntaxKind.JSDocTypeTag:
            break;
        case ts.SyntaxKind.JSDocTemplateTag:
            break;
        case ts.SyntaxKind.JSDocTypedefTag:
            break;
        case ts.SyntaxKind.JSDocPropertyTag:
            break;
        case ts.SyntaxKind.SyntaxList:
            break;
        case ts.SyntaxKind.NotEmittedStatement:
            break;
        case ts.SyntaxKind.PartiallyEmittedExpression:
            break;
        case ts.SyntaxKind.CommaListExpression:
            break;
        case ts.SyntaxKind.MergeDeclarationMarker:
            break;
        case ts.SyntaxKind.EndOfDeclarationMarker:
            break;
        case ts.SyntaxKind.SyntheticReferenceExpression:
            break;
        case ts.SyntaxKind.Count:
            break;
        case ts.SyntaxKind.FirstAssignment:
            s = s + ' ' + operatorString(node.kind);
            break;
        case ts.SyntaxKind.LastAssignment:
            break;
        case ts.SyntaxKind.FirstCompoundAssignment:
            break;
        case ts.SyntaxKind.LastCompoundAssignment:
            break;
        case ts.SyntaxKind.FirstReservedWord:
            break;
        case ts.SyntaxKind.LastReservedWord:
            break;
        case ts.SyntaxKind.FirstKeyword:
            break;
        case ts.SyntaxKind.LastKeyword:
            break;
        case ts.SyntaxKind.FirstFutureReservedWord:
            break;
        case ts.SyntaxKind.LastFutureReservedWord:
            break;
        case ts.SyntaxKind.FirstTypeNode:
            break;
        case ts.SyntaxKind.LastTypeNode:
            break;
        case ts.SyntaxKind.FirstPunctuation:
            break;
        case ts.SyntaxKind.LastPunctuation:
            break;
        case ts.SyntaxKind.FirstToken:
            break;
        case ts.SyntaxKind.LastToken:
            break;
        case ts.SyntaxKind.FirstTriviaToken:
            break;
        case ts.SyntaxKind.LastTriviaToken:
            break;
        case ts.SyntaxKind.FirstLiteralToken:
            break;
        case ts.SyntaxKind.LastLiteralToken:
            break;
        case ts.SyntaxKind.FirstTemplateToken:
            break;
        case ts.SyntaxKind.LastTemplateToken:
            break;
        case ts.SyntaxKind.FirstBinaryOperator:
            break;
        case ts.SyntaxKind.LastBinaryOperator:
            break;
        case ts.SyntaxKind.FirstStatement:
            break;
        case ts.SyntaxKind.LastStatement:
            break;
        case ts.SyntaxKind.FirstNode:
            break;
        case ts.SyntaxKind.FirstJSDocNode:
            break;
        case ts.SyntaxKind.LastJSDocNode:
            break;
        case ts.SyntaxKind.FirstJSDocTagNode:
            break;
        case ts.SyntaxKind.LastJSDocTagNode:
            break;
    }

    return s;
}

function visit(node: ts.Node, prefix: string) {
    console.log(prefix, nodeToString(node));
    ts.forEachChild(node, (node) => visit(node, prefix + '  '));
}

function dumpASTNode(sourceFile: ts.SourceFile) {
    ts.forEachChild(sourceFile, (node) => visit(node, ''));
}

export function DumpAST(fileNames: string[]) {
    const options: ts.CompilerOptions = {
        noEmitOnError: true,
        noImplicitAny: true,
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.ESNext,
        allowJs: true,
        noEmit: true,
    };

    const program = ts.createProgram(fileNames, options);
    const emitResult = program.emit();

    const allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

    const checker = program.getTypeChecker();
    //show_programer(program);

    allDiagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
            const { line, character } = ts.getLineAndCharacterOfPosition(
                diagnostic.file,
                diagnostic.start!,
            );
            const message = ts.flattenDiagnosticMessageText(
                diagnostic.messageText,
                '\n',
            );
            console.log(
                `${diagnostic.file.fileName} (${line + 1},${
                    character + 1
                }): ${message}`,
            );
            return undefined;
        } else {
            console.log(
                ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            );
        }
    });

    for (const sourceFile of program.getSourceFiles()) {
        if (fileNames.find((f) => f == sourceFile.fileName)) {
            // Walk the tree to search for classes
            console.log('===========================================');
            dumpASTNode(sourceFile);
            console.log('===========================================');
        }
    }
}

function ObjectMemberToString(v: any, objvalues: Set<any>): string {
    if (typeof v == 'object') {
        if (objvalues.has(v)) return '';

        objvalues.add(v);
        let s = '{';
        for (const k in v) {
            s = s + `${k}:${ObjectMemberToString(v[k], objvalues)}, `;
        }
        s = s + '}';
        return s;
    } else if (typeof v == 'function') {
        return 'Function';
    }
    return `${v}`;
}

export function ObjectToString(obj: any): string {
    return ObjectMemberToString(obj, new Set());
}
