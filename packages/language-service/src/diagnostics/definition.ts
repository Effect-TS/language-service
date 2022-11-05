import type ts from "typescript/lib/tsserverlibrary"

export interface DiagnosticDefinitionMessage {
  node: ts.Node
  category: ts.DiagnosticCategory
  messageText: string
}

export interface DiagnosticDefinition {
  code: number
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
