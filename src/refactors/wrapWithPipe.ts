import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const wrapWithPipe = LSP.createRefactor({
  name: "wrapWithPipe",
  description: "Wrap with pipe",
  apply: Nano.fn("wrapWithPipe.apply")(function*(sourceFile, textRange) {
    if (textRange.end - textRange.pos === 0) {
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
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
