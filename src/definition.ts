/**
 * @since 1.0.0
 */
import * as Data from "effect/Data"
import type ts from "typescript"
import type * as Nano from "./utils/Nano.js"
import type * as TypeCheckerApi from "./utils/TypeCheckerApi.js"
import type * as TypeScriptApi from "./utils/TypeScriptApi.js"

export class RefactorNotApplicableError
  extends Data.TaggedError("RefactorNotApplicableError")<{}>
{}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface RefactorDefinition {
  name: string
  description: string
  apply: (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => Nano.Nano<
    ApplicableRefactorDefinition,
    RefactorNotApplicableError,
    TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi
  >
}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

/**
 * @since 1.0.0
 * @category plugin
 */
export function createRefactor(definition: RefactorDefinition) {
  return definition
}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface DiagnosticDefinition {
  code: number
  apply: (ts: TypeScriptApi.TypeScriptApi, program: ts.Program, options: PluginOptions) => (
    sourceFile: ts.SourceFile,
    standardDiagnostic: ReadonlyArray<ts.Diagnostic>
  ) => Array<ApplicableDiagnosticDefinition>
}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface ApplicableDiagnosticDefinition {
  node: ts.Node
  category: ts.DiagnosticCategory
  messageText: string
}

/**
 * @since 1.0.0
 * @category plugin
 */
export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface PluginOptions {
  diagnostics: boolean
  quickinfo: boolean
}
