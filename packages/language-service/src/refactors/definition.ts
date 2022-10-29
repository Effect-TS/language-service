import type * as T from "@effect/core/io/Effect"
import type * as O from "@tsplus/stdlib/data/Maybe"
import type ts from "typescript/lib/tsserverlibrary"

export interface RefactorDefinition {
  name: string
  description: string
  apply: <E>(
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => T.Effect<
    typeof ts | ts.LanguageService,
    E,
    O.Maybe<{
      description: string
      apply: T.Effect<typeof ts | ts.LanguageService | ts.textChanges.ChangeTracker, E, void>
    }>
  >
}

export function createRefactor(definition: RefactorDefinition) {
  return definition
}
