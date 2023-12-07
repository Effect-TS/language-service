/**
 * @since 1.0.0
 */
import type * as O from "effect/Option"
import type ts from "typescript"
import type * as AST from "./utils/AST.js"

/**
 * @since 1.0.0
 * @category plugin
 */
export interface RefactorDefinition {
  name: string
  description: string
  apply: (ts: AST.TypeScriptApi, program: ts.Program) => (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => O.Option<ApplicableRefactorDefinition>
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
