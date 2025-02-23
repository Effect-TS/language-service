import type ts from "typescript"

declare module "typescript" {
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

  export interface TypeChecker {
    isTypeAssignableTo(source: ts.Type, target: ts.Type): boolean
  }
}

export type TypeScriptApi = typeof ts
