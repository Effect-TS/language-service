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
  ) => Effect<
    typeof ts | ts.Program,
    E,
    Chunk<DiagnosticDefinitionMessage>
  >
}

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}
