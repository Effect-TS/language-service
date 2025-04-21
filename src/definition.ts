import * as Data from "effect/Data"
import type ts from "typescript"
import * as Nano from "./utils/Nano.js"
import type * as TypeCheckerApi from "./utils/TypeCheckerApi.js"
import type * as TypeScriptApi from "./utils/TypeScriptApi.js"

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
}

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}

export interface PluginOptions {
  diagnostics: boolean
  quickinfo: boolean
}

export const PluginOptions = Nano.Tag<PluginOptions>("PluginOptions")
