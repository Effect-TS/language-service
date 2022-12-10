import type * as AST from "@effect/language-service/utils/AST"
import type * as Ch from "@effect/language-service/utils/ReadonlyArray"

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
