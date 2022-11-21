import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/wrapWithPipe",
  description: "Wrap with pipe",
  apply: (sourceFile, textRange) =>
    T.sync(() => {
      if (textRange.end - textRange.pos === 0) return O.none

      return O.some({
        description: `Wrap with pipe(...)`,
        apply: T.gen(function*($) {
          const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))
          changeTracker.insertText(sourceFile, textRange.pos, "pipe(")
          changeTracker.insertText(sourceFile, textRange.end, ")")
        })
      })
    })
})
