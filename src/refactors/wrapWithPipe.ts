import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as Nano from "../utils/Nano.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const wrapWithPipe = createRefactor({
  name: "effect/wrapWithPipe",
  description: "Wrap with pipe",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      if (textRange.end - textRange.pos === 0) {
        return yield* Nano.fail(new RefactorNotApplicableError())
      }

      return ({
        kind: "refactor.rewrite.effect.wrapWithPipe",
        description: `Wrap with pipe(...)`,
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          changeTracker.insertText(sourceFile, textRange.pos, "pipe(")
          changeTracker.insertText(sourceFile, textRange.end, ")")
        })
      })
    })
})
