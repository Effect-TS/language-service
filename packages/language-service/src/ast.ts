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
    export class ChangeTracker {
      static with(context: ts.TextChangesContext, cb: (tracker: ChangeTracker) => void): ts.FileTextChanges[]
      replaceNode(sourceFile: ts.SourceFile, oldNode: ts.Node, newNode: ts.Node, options?: ts.ChangeNodeOptions): void
    }
    export function applyChanges(text: string, changes: readonly ts.TextChange[]): string
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
  return Effect.service(TypeScriptProgram).map(program => program.getSourceFile(fileName))
    .filterOrFail((sourceFile): sourceFile is ts.SourceFile => !!sourceFile, () => new NoSuchSourceFile(fileName))
}

export function hasModifier(node: ts.Declaration, kind: ts.ModifierFlags) {
  return Effect.serviceWith(TypeScriptApi, ts => !!(ts.getCombinedModifierFlags(node) & kind))
}

/**
 * Gets the closest node that contains given TextRange
 */
export function getNodesContainingRange(
  ts: TypeScriptApi
) {
  return ((sourceFile: ts.SourceFile, textRange: ts.TextRange) => {
    const precedingToken = ts.findPrecedingToken(textRange.pos, sourceFile)
    if (!precedingToken) return Chunk.empty()

    let result = Chunk.empty<ts.Node>()
    let parent = precedingToken
    while (parent) {
      result = result.append(parent)
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
    let result = Chunk.empty<A>()

    function visitor(node: ts.Node) {
      if (test(node)) result = result.append(node)
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
      return { contextToken: Maybe.some(contextToken), previousToken: Maybe.some(previousToken) }
    }
    return { contextToken: Maybe.fromNullable(previousToken), previousToken: Maybe.fromNullable(previousToken) }
  })
}

export function isNodeInRange(textRange: ts.TextRange) {
  return (node: ts.Node) => node.pos <= textRange.pos && node.end >= textRange.end
}
