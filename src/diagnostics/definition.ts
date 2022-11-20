import type * as T from "@effect/core/io/Effect"
import type * as Ch from "@tsplus/stdlib/collections/Chunk"

import type ts from "typescript/lib/tsserverlibrary"

export interface DiagnosticDefinitionMessage {
  node: ts.Node
  messageText: string
}

export type DiagnosticDefinitionMessageCategory = "none" | "suggestion" | "warning" | "error"

export interface DiagnosticDefinition {
  code: number
  category: DiagnosticDefinitionMessageCategory
  apply: <E>(
    sourceFile: ts.SourceFile
  ) => T.Effect<
    typeof ts | ts.Program,
    E,
    Ch.Chunk<DiagnosticDefinitionMessage>
  >
}

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}
