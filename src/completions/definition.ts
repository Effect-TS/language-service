import type * as AST from "@effect/language-service/utils/AST"
import type * as O from "@effect/language-service/utils/Option"
import type ts from "typescript/lib/tsserverlibrary"

export interface CompletionDefinition {
  name: string
  description: string
  apply: (ts: AST.TypeScriptApi, program: ts.Program) => (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => O.Option<ApplicableCompletionDefinition>
}

export interface ApplicableCompletionDefinition {
  name: string
  sortText: string
  insertText: string
  isRecommended?: true
  replacementSpan?: ts.TextSpan
}

export function createCompletion(definition: CompletionDefinition) {
  return definition
}

export function createApplicableCompletionDefinition(definition: ApplicableCompletionDefinition) {
  return definition
}
