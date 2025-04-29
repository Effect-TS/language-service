import * as ReadonlyArray from "effect/Array"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import type * as TypeScriptApi from "../utils/TypeScriptApi.js"
import * as Nano from "./Nano.js"

export class RefactorNotApplicableError
  extends Data.TaggedError("RefactorNotApplicableError")<{}>
{}

export interface RefactorDefinition {
  name: string
  description: string
  apply: (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => Nano.Nano<
    ApplicableRefactorDefinition,
    RefactorNotApplicableError,
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export function createRefactor(definition: RefactorDefinition): RefactorDefinition {
  return definition
}

export interface DiagnosticDefinition {
  name: string
  code: number
  apply: (
    sourceFile: ts.SourceFile
  ) => Nano.Nano<
    Array<ApplicableDiagnosticDefinition>,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface ApplicableDiagnosticDefinition {
  node: ts.Node
  category: ts.DiagnosticCategory
  messageText: string
  fix: Option.Option<ApplicableDiagnosticDefinitionFix>
}

export interface ApplicableDiagnosticDefinitionFix {
  fixName: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export function createDiagnostic(definition: DiagnosticDefinition): DiagnosticDefinition {
  return definition
}

export interface PluginOptions {
  diagnostics: boolean
  quickinfo: boolean
  completions: boolean
}

export interface CompletionDefinition {
  name: string
  apply: (
    sourceFile: ts.SourceFile,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined,
    formatCodeSettings: ts.FormatCodeSettings | undefined
  ) => Nano.Nano<
    Array<CompletionEntryDefinition>,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface CompletionEntryDefinition {
  name: string
  kind: ts.ScriptElementKind
  sortText: string
  insertText: string
  filterText: string
  isSnippet: true
  replacementSpan: ts.TextSpan
}

export function createCompletion(definition: CompletionDefinition): CompletionDefinition {
  return definition
}

export const PluginOptions = Nano.Tag<PluginOptions>("PluginOptions")

export class SourceFileNotFoundError extends Data.TaggedError("SourceFileNotFoundError")<{
  fileName: string
}> {}

export const getSemanticDiagnostics = Nano.fn("LSP.getSemanticDiagnostics")(function*(
  diagnostics: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile
) {
  const effectDiagnostics: Array<ts.Diagnostic> = []
  for (const diagnostic of diagnostics) {
    const result = yield* (
      Nano.option(diagnostic.apply(sourceFile))
    )
    if (Option.isSome(result)) {
      effectDiagnostics.push(...result.value.map((_) => ({
        file: sourceFile,
        start: _.node.getStart(sourceFile),
        length: _.node.getEnd() - _.node.getStart(sourceFile),
        messageText: _.messageText,
        category: _.category,
        code: diagnostic.code,
        source: "effect"
      })))
    }
  }
  return effectDiagnostics
})

export const getCodeFixesAtPosition = Nano.fn("LSP.getCodeFixesAtPosition")(function*(
  diagnostics: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile,
  start: number,
  end: number,
  errorCodes: ReadonlyArray<number>
) {
  const runnableDiagnostics = diagnostics.filter((_) => errorCodes.indexOf(_.code) > -1)
  const applicableFixes: Array<ApplicableDiagnosticDefinitionFix> = []
  for (const diagnostic of runnableDiagnostics) {
    const result = yield* Nano.option(diagnostic.apply(sourceFile))
    if (Option.isSome(result)) {
      applicableFixes.push(
        ...pipe(
          result.value,
          ReadonlyArray.filter((_) =>
            _.node.getStart(sourceFile) === start && _.node.getEnd() === end
          ),
          ReadonlyArray.map((_) => _.fix),
          ReadonlyArray.getSomes
        )
      )
    }
  }
  return applicableFixes
})

export const getApplicableRefactors = Nano.fn("LSP.getApplicableRefactors")(function*(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange
) {
  const textRange = typeof positionOrRange === "number"
    ? { pos: positionOrRange, end: positionOrRange }
    : positionOrRange
  const effectRefactors: Array<ts.ApplicableRefactorInfo> = []
  for (const refactor of refactors) {
    const result = yield* Nano.option(refactor.apply(sourceFile, textRange))
    if (Option.isSome(result)) {
      effectRefactors.push({
        name: refactor.name,
        description: refactor.description,
        actions: [{
          name: refactor.name,
          description: result.value.description,
          kind: result.value.kind
        }]
      })
    }
  }
  return effectRefactors
})

export const getEditsForRefactor = Nano.fn("LSP.getEditsForRefactor")(function*(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange,
  refactorName: string
) {
  const refactor = refactors.find((refactor) => refactor.name === refactorName)
  if (!refactor) {
    return yield* Nano.fail(new RefactorNotApplicableError())
  }
  const textRange = typeof positionOrRange === "number"
    ? { pos: positionOrRange, end: positionOrRange }
    : positionOrRange

  return yield* refactor.apply(sourceFile, textRange)
})

export const getCompletionsAtPosition = Nano.fn("LSP.getCompletionsAtPosition")(function*(
  completions: Array<CompletionDefinition>,
  sourceFile: ts.SourceFile,
  position: number,
  options: ts.GetCompletionsAtPositionOptions | undefined,
  formatCodeSettings: ts.FormatCodeSettings | undefined
) {
  const effectCompletions: Array<ts.CompletionEntry> = []
  for (const completion of completions) {
    const result = yield* completion.apply(sourceFile, position, options, formatCodeSettings)
    effectCompletions.push(
      ...result.map((_) => ({ ..._ }) satisfies ts.CompletionEntry)
    )
  }
  return effectCompletions
})
