import { createRefactor } from "@effect/language-service/refactors/definition"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/wrapWithPipe",
  description: "Wrap with pipe",
  apply: () =>
    (sourceFile, textRange) => {
      if (textRange.end - textRange.pos === 0) return O.none

      return O.some({
        description: `Wrap with pipe(...)`,
        apply: (changeTracker) => {
          changeTracker.insertText(sourceFile, textRange.pos, "pipe(")
          changeTracker.insertText(sourceFile, textRange.end, ")")
        }
      })
    }
})
