import type ts from "typescript/lib/tsserverlibrary"

export interface DiagnosticDefinition {
  code: number
  apply: <E>(
    sourceFile: ts.SourceFile
  ) => Effect<
    typeof ts | ts.LanguageService,
    E,
    Chunk<{
      node: ts.Node
      category: ts.DiagnosticCategory
      messageText: string
    }>
  >
}

export function createDiagnostic(definition: DiagnosticDefinition) {
  return definition
}
