import { createRefactor } from "@effect/language-service/refactors/definition"
import * as O from "@effect/language-service/utils/Option"

export default createRefactor({
  name: "effect/wrapWithPipe",
  description: "Wrap with pipe",
  apply: () =>
    (sourceFile, textRange) => {
      if (textRange.end - textRange.pos === 0) return O.none

      return O.some({
        kind: "refactor.rewrite.effect.wrapWithPipe",
        description: `Wrap with pipe(...)`,
        apply: (changeTracker) => {
          changeTracker.insertText(sourceFile, textRange.pos, "pipe(")
          changeTracker.insertText(sourceFile, textRange.end, ")")
        }
      })
    }
})
