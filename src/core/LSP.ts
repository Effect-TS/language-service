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
    TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi | PluginOptions
  >
}

export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export function createRefactor(definition: RefactorDefinition) {
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
    TypeCheckerApi.TypeCheckerApi | PluginOptions | TypeScriptApi.TypeScriptApi
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

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}

export interface PluginOptions {
  diagnostics: boolean
  quickinfo: boolean
}

export const PluginOptions = Nano.Tag<PluginOptions>("PluginOptions")

export class SourceFileNotFoundError extends Data.TaggedError("SourceFileNotFoundError")<{
  fileName: string
}> {}

export function getSemanticDiagnostics(
  diagnostics: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile
) {
  return Nano.gen(function*() {
    const effectDiagnostics: Array<ts.Diagnostic> = []
    for (const diagnostic of diagnostics) {
      const result = yield* Nano.option(diagnostic.apply(sourceFile))
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
}

export function getCodeFixesAtPosition(
  diagnostics: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile,
  start: number,
  end: number,
  errorCodes: ReadonlyArray<number>
) {
  return Nano.gen(function*() {
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
}

export function getApplicableRefactors(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange
) {
  return Nano.gen(function*() {
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
}

export function getEditsForRefactor(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange,
  refactorName: string
) {
  return Nano.gen(function*() {
    const refactor = refactors.find((refactor) => refactor.name === refactorName)
    if (!refactor) {
      return yield* Nano.fail(new RefactorNotApplicableError())
    }
    const textRange = typeof positionOrRange === "number"
      ? { pos: positionOrRange, end: positionOrRange }
      : positionOrRange

    return yield* refactor.apply(sourceFile, textRange)
  })
}
