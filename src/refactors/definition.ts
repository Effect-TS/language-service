import type * as AST from "@effect/language-service/utils/AST"
import type * as O from "@effect/language-service/utils/Option"
import type ts from "typescript/lib/tsserverlibrary"

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
