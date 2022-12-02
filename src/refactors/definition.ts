import type * as T from "@effect/io/Effect"
import type * as O from "@fp-ts/data/Option"
import type ts from "typescript/lib/tsserverlibrary"

export interface RefactorDefinition {
  name: string
  description: string
  apply: <E>(
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => T.Effect<
    typeof ts | ts.Program,
    E,
    O.Option<{
      description: string
      apply: T.Effect<typeof ts | ts.Program | ts.textChanges.ChangeTracker, E, void>
    }>
  >
}

export function createRefactor(definition: RefactorDefinition) {
  return definition
}
