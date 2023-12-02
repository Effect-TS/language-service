import type ts from "typescript/lib/tsserverlibrary.js"
import { pipe } from "./Function.js"
import * as O from "./Option.js"
import * as Ch from "./ReadonlyArray.js"

declare module "typescript/lib/tsserverlibrary.js" {
  const nullTransformationContext: ts.TransformationContext

  export namespace formatting {
    interface FormattingHost {
      getNewLine?(): string
    }

    export interface FormatContext {
      readonly options: ts.FormatCodeSettings
      readonly getRules: unknown
    }

    function getFormatContext(options: ts.FormatCodeSettings, host: FormattingHost): FormatContext
  }

  export type TextChangesContext = any
  export type ChangeNodeOptions = any

  export namespace textChanges {
    export enum LeadingTriviaOption {
      /** Exclude all leading trivia (use getStart()) */
      Exclude = 0,
      /** Include leading trivia and,
       * if there are no line breaks between the node and the previous token,
       * include all trivia between the node and the previous token
       */
      IncludeAll = 1,
      /**
       * Include attached JSDoc comments
       */
      JSDoc = 2,
      /**
       * Only delete trivia on the same line as getStart().
       * Used to avoid deleting leading comments
       */
      StartLine = 3
    }
    export enum TrailingTriviaOption {
      /** Exclude all trailing trivia (use getEnd()) */
      Exclude = 0,
      /** Doesn't include whitespace, but does strip comments */
      ExcludeWhitespace = 1,
      /** Include trailing trivia */
      Include = 2
    }
    export interface ConfigurableStart {
      leadingTriviaOption?: LeadingTriviaOption
    }
    export interface ConfigurableEnd {
      trailingTriviaOption?: TrailingTriviaOption
    }
    export interface InsertNodeOptions {
      /**
       * Text to be inserted before the new node
       */
      prefix?: string
      /**
       * Text to be inserted after the new node
       */
      suffix?: string
      /**
       * Text of inserted node will be formatted with this indentation, otherwise indentation will be inferred from the old node
       */
      indentation?: number
      /**
       * Text of inserted node will be formatted with this delta, otherwise delta will be inferred from the new node kind
       */
      delta?: number
    }
    export interface ConfigurableStartEnd extends ConfigurableStart, ConfigurableEnd {
    }
    export class ChangeTracker {
      static with(
        context: ts.TextChangesContext,
        cb: (tracker: ChangeTracker) => void
      ): Array<ts.FileTextChanges>
      delete(
        sourceFile: ts.SourceFile,
        node: ts.Node | ts.NodeArray<ts.TypeParameterDeclaration>
      ): void
      deleteRange(sourceFile: ts.SourceFile, range: ts.TextRange): void
      replaceNode(
        sourceFile: ts.SourceFile,
        oldNode: ts.Node,
        newNode: ts.Node,
        options?: ts.ChangeNodeOptions
      ): void
      insertNodeAt(
        sourceFile: ts.SourceFile,
        pos: number,
        newNode: ts.Node,
        options?: ts.textChanges.InsertNodeOptions
      ): void
      insertNodeBefore(
        sourceFile: ts.SourceFile,
        before: ts.Node,
        newNode: ts.Node,
        blankLineBetween?: boolean,
        options?: ConfigurableStartEnd
      ): void
      insertNodeAfter(sourceFile: ts.SourceFile, after: ts.Node, newNode: ts.Node): void
      insertText(sourceFile: ts.SourceFile, pos: number, text: string): void
    }
    export function applyChanges(text: string, changes: ReadonlyArray<ts.TextChange>): string
  }

  export function findPrecedingToken(
    position: number,
    sourceFile: ts.SourceFileLike,
    startNode: ts.Node,
    excludeJsdoc?: boolean
  ): ts.Node | undefined
  export function findPrecedingToken(
    position: number,
    sourceFile: ts.SourceFile,
    startNode?: ts.Node,
    excludeJsdoc?: boolean
  ): ts.Node | undefined
  function findChildOfKind<T extends ts.Node>(
    n: ts.Node,
    kind: T["kind"],
    sourceFile: ts.SourceFileLike
  ): T | undefined

  export function isMemberName(node: ts.Node): node is ts.MemberName
  export function isKeyword(token: ts.SyntaxKind): token is ts.KeywordSyntaxKind
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type TypeScriptApi = typeof import("typescript/lib/tsserverlibrary.js")

export class NoSuchSourceFile {
  readonly _tag = "NoSuchSourceFile"
  constructor(
    readonly fileName: string
  ) {}
}

export function getSourceFile(program: ts.Program) {
  return (fileName: string) => {
    const sourceFile = program.getSourceFile(fileName)
    if (!sourceFile) {
      throw new NoSuchSourceFile(fileName)
    }
    return sourceFile
  }
}

export function hasModifier(ts: TypeScriptApi) {
  return (node: ts.Declaration, kind: ts.ModifierFlags) =>
    !!(ts.getCombinedModifierFlags(node) & kind)
}

/**
 * Gets the closest node that contains given TextRange
 */
export function getNodesContainingRange(
  ts: TypeScriptApi
) {
  return ((sourceFile: ts.SourceFile, textRange: ts.TextRange) => {
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return Ch.empty

    let result: Ch.Chunk<ts.Node> = Ch.empty
    let parent = precedingToken
    while (parent) {
      result = pipe(result, Ch.append(parent))
      parent = parent.parent
    }

    return result
  })
}

/**
 * Ensures value is a text range
 */
export function toTextRange(positionOrRange: number | ts.TextRange): ts.TextRange {
  return typeof positionOrRange === "number"
    ? { end: positionOrRange, pos: positionOrRange }
    : positionOrRange
}

export function getHumanReadableName(sourceFile: ts.SourceFile, node: ts.Node) {
  const text = node.getText(sourceFile)
  return text.length > 10 ? text.substring(0, 10) + "..." : text
}

export function collectAll(ts: TypeScriptApi) {
  return <A extends ts.Node>(rootNode: ts.Node, test: (node: ts.Node) => node is A) => {
    let result: Ch.Chunk<A> = Ch.empty

    function visitor(node: ts.Node) {
      if (test(node)) result = pipe(result, Ch.append(node))
      ts.forEachChild(node, visitor)
    }

    visitor(rootNode)

    return result
  }
}

export function getRelevantTokens(
  ts: TypeScriptApi
) {
  return ((position: number, sourceFile: ts.SourceFile) => {
    const previousToken = ts.findPrecedingToken(position, sourceFile)
    if (
      previousToken && position <= previousToken.end &&
      (ts.isMemberName(previousToken) || ts.isKeyword(previousToken.kind))
    ) {
      const contextToken = ts.findPrecedingToken(
        previousToken.getFullStart(),
        sourceFile,
        /*startNode*/ undefined
      )! // TODO: GH#18217
      return { contextToken: O.some(contextToken), previousToken: O.some(previousToken) }
    }
    return {
      contextToken: O.fromNullable(previousToken),
      previousToken: O.fromNullable(previousToken)
    }
  })
}

export function isNodeInRange(textRange: ts.TextRange) {
  return (node: ts.Node) => node.pos <= textRange.pos && node.end >= textRange.end
}

export function findModuleNamedBindings(
  ts: TypeScriptApi
) {
  return (sourceFile: ts.SourceFile, moduleName: string) =>
    O.fromNullable(ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return
      const moduleSpecifier = node.moduleSpecifier
      if (!ts.isStringLiteral(moduleSpecifier)) return
      if (moduleSpecifier.text !== moduleName) return
      const importClause = node.importClause
      if (!importClause) return
      const namedBindings = importClause.namedBindings
      if (!namedBindings) return
      return namedBindings
    }))
}

export function findModuleNamespaceImportIdentifierName(
  ts: TypeScriptApi
) {
  return (sourceFile: ts.SourceFile, moduleName: string) =>
    pipe(
      findModuleNamedBindings(ts)(sourceFile, moduleName),
      O.map(
        (namedBindings) => {
          if (!ts.isNamespaceImport(namedBindings)) return
          return namedBindings.name.text
        }
      ),
      O.flatMap(O.fromNullable)
    )
}

export function findModuleNamedImportIdentifierName(
  ts: TypeScriptApi
) {
  return (sourceFile: ts.SourceFile, moduleName: string, namedImport: string) =>
    pipe(
      findModuleNamedBindings(ts)(sourceFile, moduleName),
      O.map((namedBindings) => {
        if (!ts.isNamedImports(namedBindings)) return
        for (const importSpecifier of namedBindings.elements) {
          if (importSpecifier.propertyName?.escapedText === namedImport) {
            return importSpecifier.name?.escapedText || importSpecifier.propertyName?.escapedText
          }
        }
      }),
      O.flatMap(O.fromNullable)
    )
}

export function findModuleImportIdentifierNameViaTypeChecker(
  ts: TypeScriptApi,
  typeChecker: ts.TypeChecker
) {
  return (sourceFile: ts.SourceFile, importName: string) => {
    return O.fromNullable(ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return
      if (!node.importClause) return
      const namedBindings = node.importClause.namedBindings
      if (!namedBindings) return
      if (ts.isNamespaceImport(namedBindings)) {
        const symbol = typeChecker.getTypeAtLocation(namedBindings).getSymbol()
        if (!symbol || !symbol.exports) return
        if (!symbol.exports.has(importName as ts.__String)) return
        return namedBindings.name.escapedText as string
      }
      if (ts.isNamedImports(namedBindings)) {
        for (const importSpecifier of namedBindings.elements) {
          const symbol = typeChecker.getTypeAtLocation(importSpecifier).getSymbol()
          if (!symbol || !symbol.exports) return
          if (!symbol.exports.has(importName as ts.__String)) return
          return importSpecifier.name?.escapedText ||
            importSpecifier.propertyName?.escapedText as string
        }
      }
    }))
  }
}

export function transformAsyncAwaitToEffectGen(
  ts: TypeScriptApi
) {
  return (
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    effectName: string,
    onAwait: (expression: ts.Expression) => ts.Expression
  ) => {
    function visitor(_: ts.Node): ts.Node {
      if (ts.isAwaitExpression(_)) {
        const expression = ts.visitEachChild(_.expression, visitor, ts.nullTransformationContext)

        return ts.factory.createYieldExpression(
          ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
          ts.factory.createCallExpression(ts.factory.createIdentifier("$"), undefined, [
            onAwait(expression)
          ])
        )
      }
      return ts.visitEachChild(_, visitor, ts.nullTransformationContext)
    }
    const generatorBody = visitor(node.body!)

    const generator = ts.factory.createFunctionExpression(
      [],
      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
      undefined,
      [],
      [ts.factory.createParameterDeclaration(undefined, undefined, "$")],
      undefined,
      generatorBody as any // NOTE(mattia): intended, to use same routine for both ConciseBody and Body
    )

    const effectGenCallExp = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(effectName),
        "gen"
      ),
      undefined,
      [generator as any]
    )

    let currentFlags = ts.getCombinedModifierFlags(node)
    currentFlags &= ~ts.ModifierFlags.Async
    const newModifiers = ts.factory.createModifiersFromModifierFlags(currentFlags)

    if (ts.isArrowFunction(node)) {
      return ts.factory.createArrowFunction(
        newModifiers,
        node.typeParameters,
        node.parameters,
        undefined,
        node.equalsGreaterThanToken,
        effectGenCallExp
      )
    }

    const newBody = ts.factory.createBlock([
      ts.factory.createReturnStatement(effectGenCallExp)
    ])

    if (ts.isFunctionDeclaration(node)) {
      return ts.factory.createFunctionDeclaration(
        newModifiers,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        node.parameters,
        undefined,
        newBody
      )
    }
    return ts.factory.createFunctionExpression(
      newModifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      undefined,
      newBody
    )
  }
}

export function addReturnTypeAnnotation(
  ts: TypeScriptApi,
  changes: ts.textChanges.ChangeTracker
) {
  return (
    sourceFile: ts.SourceFile,
    declaration:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | ts.MethodDeclaration,
    typeNode: ts.TypeNode
  ) => {
    const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
    const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
    const endNode = needParens ? declaration.parameters[0] : closeParen
    if (endNode) {
      if (needParens) {
        changes.insertNodeBefore(
          sourceFile,
          endNode,
          ts.factory.createToken(ts.SyntaxKind.OpenParenToken)
        )
        changes.insertNodeAfter(
          sourceFile,
          endNode,
          ts.factory.createToken(ts.SyntaxKind.CloseParenToken)
        )
      }
      changes.insertNodeAt(sourceFile, endNode.end, typeNode, { prefix: ": " })
    }
  }
}

export function removeReturnTypeAnnotation(
  ts: TypeScriptApi,
  changes: ts.textChanges.ChangeTracker
) {
  return (
    sourceFile: ts.SourceFile,
    declaration:
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.ArrowFunction
      | ts.MethodDeclaration
  ) => {
    const closeParen = ts.findChildOfKind(declaration, ts.SyntaxKind.CloseParenToken, sourceFile)
    const needParens = ts.isArrowFunction(declaration) && closeParen === undefined
    const endNode = needParens ? declaration.parameters[0] : closeParen
    if (endNode && declaration.type) {
      changes.deleteRange(sourceFile, { pos: endNode.end, end: declaration.type.end })
    }
  }
}

export function getEffectModuleIdentifier(ts: TypeScriptApi, typeChecker: ts.TypeChecker) {
  return (sourceFile: ts.SourceFile) =>
    pipe(
      findModuleNamespaceImportIdentifierName(ts)(sourceFile, "effect/Effect"),
      O.orElse(findModuleNamedImportIdentifierName(ts)(sourceFile, "effect", "Effect")),
      O.orElse(findModuleImportIdentifierNameViaTypeChecker(ts, typeChecker)(sourceFile, "Effect")),
      O.getOrElse(
        () => "Effect"
      )
    )
}

export function simplifyTypeNode(
  ts: TypeScriptApi
) {
  function collectCallable(typeNode: ts.TypeNode): O.Option<Array<ts.CallSignatureDeclaration>> {
    // (() => 1) -> skip to inner node
    if (ts.isParenthesizedTypeNode(typeNode)) return collectCallable(typeNode.type)
    // () => 1 -> convert to call signature
    if (ts.isFunctionTypeNode(typeNode)) {
      return O.some([
        ts.factory.createCallSignature(typeNode.typeParameters, typeNode.parameters, typeNode.type)
      ])
    }
    // { ... } -> if every member is callsignature, return a merge of all of those
    if (ts.isTypeLiteralNode(typeNode)) {
      const allCallSignatures = typeNode.members.every(ts.isCallSignatureDeclaration)
      if (allCallSignatures) {
        return O.some(typeNode.members as any as Array<ts.CallSignatureDeclaration>)
      }
    }
    // ... & ... -> if both are callable, return merge of both
    if (ts.isIntersectionTypeNode(typeNode)) {
      const members = typeNode.types.map(collectCallable)
      if (members.every(O.isSome)) {
        return O.some(members.map((_) => O.isSome(_) ? _.value : []).flat())
      }
    }

    return O.none
  }

  return (typeNode: ts.TypeNode) => {
    const callSignatures = collectCallable(typeNode)
    if (O.isSome(callSignatures) && callSignatures.value.length > 1) {
      return ts.factory.createTypeLiteralNode(callSignatures.value)
    }
    return typeNode
  }
}

export function isPipeCall(ts: TypeScriptApi) {
  return (node: ts.Node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node)) return false
    const expression = node.expression
    if (!ts.isIdentifier(expression)) return false
    if (expression.text !== "pipe") return false
    return true
  }
}

export function asDataFirstExpression(ts: TypeScriptApi, checker: ts.TypeChecker) {
  return (node: ts.Node, self: ts.Expression): O.Option<ts.CallExpression> => {
    if (!ts.isCallExpression(node)) return O.none
    const signature = checker.getResolvedSignature(node)
    if (!signature) return O.none
    const callSignatures = checker.getTypeAtLocation(node.expression).getCallSignatures()
    for (let i = 0; i < callSignatures.length; i++) {
      const callSignature = callSignatures[i]
      if (callSignature.parameters.length === node.arguments.length + 1) {
        return O.some(
          ts.factory.createCallExpression(
            node.expression,
            [],
            [self].concat(node.arguments)
          )
        )
      }
    }
    return O.none
  }
}
