import * as T from "@effect/core/io/Effect"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"
import { Tag } from "@tsplus/stdlib/service/Tag"
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
export const TypeScriptApi = Tag<TypeScriptApi>()
export const TypeScriptProgram = Tag<ts.Program>()
export const ChangeTrackerApi = Tag<ts.textChanges.ChangeTracker>()

export class NoSuchSourceFile {
  readonly _tag = "NoSuchSourceFile"
  constructor(
    readonly fileName: string
  ) {}
}

export function getSourceFile(fileName: string) {
  return pipe(
    T.service(TypeScriptProgram),
    T.map((program) => program.getSourceFile(fileName)),
    T.filterOrFail((sourceFile): sourceFile is ts.SourceFile => !!sourceFile, () => new NoSuchSourceFile(fileName))
  )
}

export function hasModifier(node: ts.Declaration, kind: ts.ModifierFlags) {
  return T.serviceWith(TypeScriptApi, (ts) => !!(ts.getCombinedModifierFlags(node) & kind))
}

/**
 * Gets the closest node that contains given TextRange
 */
export function getNodesContainingRange(
  ts: TypeScriptApi
) {
  return ((sourceFile: ts.SourceFile, textRange: ts.TextRange) => {
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return Ch.empty()

    let result = Ch.empty<ts.Node>()
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
    let result = Ch.empty<A>()

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
