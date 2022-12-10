import type * as AST from "@effect/language-service/ast"
import type * as O from "@fp-ts/data/Option"
import type ts from "typescript/lib/tsserverlibrary"

export interface RefactorDefinition {
  name: string
  description: string
  apply: (ts: AST.TypeScriptApi, program: ts.Program) => (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => O.Option<{
    description: string
    apply: (changeTracker: ts.textChanges.ChangeTracker) => void
  }>
}

export function createRefactor(definition: RefactorDefinition) {
  return definition
}
