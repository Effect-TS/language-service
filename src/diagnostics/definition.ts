import type * as AST from "@effect/language-service/ast"
import type * as Ch from "@fp-ts/data/Chunk"

import type ts from "typescript/lib/tsserverlibrary"

export interface DiagnosticDefinitionMessage {
  node: ts.Node
  messageText: string
}

export type DiagnosticDefinitionMessageCategory = "none" | "suggestion" | "warning" | "error"

export interface DiagnosticDefinition {
  code: number
  category: DiagnosticDefinitionMessageCategory
  apply: (ts: AST.TypeScriptApi, program: ts.Program) => (
    sourceFile: ts.SourceFile
  ) => Ch.Chunk<DiagnosticDefinitionMessage>
}

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}
