/**
 * @since 1.0.0
 */
import type * as Option from "effect/Option"
import type ts from "typescript"
import type * as TSAPI from "./utils/TSAPI.js"

/**
 * @since 1.0.0
 * @category plugin
 */
export interface RefactorDefinition {
  name: string
  description: string
  apply: (ts: TSAPI.TypeScriptApi, program: ts.Program, options: PluginOptions) => (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => Option.Option<ApplicableRefactorDefinition>
}

/**
 * @since 1.0.0
 * @category plugin
 */
export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: (changeTracker: ts.textChanges.ChangeTracker) => void
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
  apply: (ts: TSAPI.TypeScriptApi, program: ts.Program, options: PluginOptions) => (
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
}
