import type ts from "typescript/lib/tsserverlibrary.js"
import type * as AST from "../utils/AST.js"
import type * as O from "../utils/Option.js"

export interface RefactorDefinition {
  name: string
  description: string
  apply: (ts: AST.TypeScriptApi, program: ts.Program) => (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => O.Option<ApplicableRefactorDefinition>
}

export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: (changeTracker: ts.textChanges.ChangeTracker) => void
}

export function createRefactor(definition: RefactorDefinition) {
  return definition
}
