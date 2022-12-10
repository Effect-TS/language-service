import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"
import type ts from "typescript/lib/tsserverlibrary"

declare module "typescript/lib/tsserverlibrary" {
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
      static with(context: ts.TextChangesContext, cb: (tracker: ChangeTracker) => void): Array<ts.FileTextChanges>
      delete(sourceFile: ts.SourceFile, node: ts.Node | ts.NodeArray<ts.TypeParameterDeclaration>): void
      deleteRange(sourceFile: ts.SourceFile, range: ts.TextRange): void
      replaceNode(sourceFile: ts.SourceFile, oldNode: ts.Node, newNode: ts.Node, options?: ts.ChangeNodeOptions): void
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
  function findChildOfKind<T extends ts.Node>(n: ts.Node, kind: T["kind"], sourceFile: ts.SourceFileLike): T | undefined

  export function isMemberName(node: ts.Node): node is ts.MemberName
  export function isKeyword(token: ts.SyntaxKind): token is ts.KeywordSyntaxKind
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type TypeScriptApi = typeof import("typescript/lib/tsserverlibrary")

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
  return (node: ts.Declaration, kind: ts.ModifierFlags) => !!(ts.getCombinedModifierFlags(node) & kind)
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
  return typeof positionOrRange === "number" ? { end: positionOrRange, pos: positionOrRange } : positionOrRange
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
      const contextToken = ts.findPrecedingToken(previousToken.getFullStart(), sourceFile, /*startNode*/ undefined)! // TODO: GH#18217
      return { contextToken: O.some(contextToken), previousToken: O.some(previousToken) }
    }
    return { contextToken: O.fromNullable(previousToken), previousToken: O.fromNullable(previousToken) }
  })
}

export function isNodeInRange(textRange: ts.TextRange) {
  return (node: ts.Node) => node.pos <= textRange.pos && node.end >= textRange.end
}

export function isPipeCall(ts: TypeScriptApi) {
  return (node: ts.Node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node)) return false
    const expression = node.expression
    if (!ts.isIdentifier(expression)) return false
    if (expression.getText(node.getSourceFile()) !== "pipe") return false
    return true
  }
}

export function asPipeableCallExpression(ts: TypeScriptApi) {
  return (node: ts.Node) => {
    // ensure the node is a call expression
    if (!ts.isCallExpression(node)) return O.none
    // with just 1 arg
    if (node.arguments.length !== 1) return O.none
    const arg = node.arguments[0]!
    // ideally T.map(n => n * 2) could be piped to pipe(n => n * 2, T.map)
    // but does not make any sense.
    if (ts.isArrowFunction(arg)) return O.none
    // same goes for identifiers, string literal or numbers
    if (ts.isStringLiteral(arg) || ts.isNumericLiteral(arg) || ts.isIdentifier(arg)) return O.none
    return O.some([node.expression, arg] as const)
  }
}

export function asPipeArguments(ts: TypeScriptApi) {
  return (initialNode: ts.Node) => {
    let result: Ch.Chunk<ts.Expression> = Ch.empty
    let currentNode: O.Option<ts.Node> = O.some(initialNode)
    while (O.isSome(currentNode)) {
      const node = currentNode.value
      const maybePipeable = asPipeableCallExpression(ts)(node)
      if (O.isNone(maybePipeable)) {
        result = pipe(result, Ch.append(node as ts.Expression))
        break
      }
      const [exp, arg] = maybePipeable.value
      result = pipe(result, Ch.append(exp))
      currentNode = O.some(arg)
    }
    return Ch.reverse(result)
  }
}

export function isPipeableCallExpression(ts: TypeScriptApi) {
  return (node: ts.Node): node is ts.CallExpression => O.isSome(asPipeableCallExpression(ts)(node))
}

export function findModuleImportIdentifierName(
  ts: TypeScriptApi
) {
  return (sourceFile: ts.SourceFile, moduleName: string) => {
    return O.fromNullable(ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return
      const moduleSpecifier = node.moduleSpecifier
      if (!ts.isStringLiteral(moduleSpecifier)) return
      if (moduleSpecifier.text !== moduleName) return
      const importClause = node.importClause
      if (!importClause) return
      const namedBindings = importClause.namedBindings
      if (!namedBindings) return
      if (!ts.isNamespaceImport(namedBindings)) return
      return namedBindings.name.text
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
          ts.factory.createCallExpression(ts.factory.createIdentifier("$"), undefined, [onAwait(expression)])
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
        changes.insertNodeBefore(sourceFile, endNode, ts.factory.createToken(ts.SyntaxKind.OpenParenToken))
        changes.insertNodeAfter(sourceFile, endNode, ts.factory.createToken(ts.SyntaxKind.CloseParenToken))
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

export function getEffectModuleIdentifier(ts: TypeScriptApi) {
  return (sourceFile: ts.SourceFile) =>
    pipe(
      findModuleImportIdentifierName(ts)(sourceFile, "@effect/io/Effect"),
      O.orElse(findModuleImportIdentifierName(ts)(sourceFile, "@effect/io/Effect")),
      O.getOrElse(
        () => "Effect"
      )
    )
}
