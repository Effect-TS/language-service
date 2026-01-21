import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const toggleLazyConst = LSP.createRefactor({
  name: "toggleLazyConst",
  description: "Toggle lazy const",
  apply: Nano.fn("toggleLazyConst.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter(ts.isVariableDeclaration),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.name)),
      Array.filter((node) =>
        !!node.initializer &&
        !(ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body))
      ),
      Array.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.toggleLazyConst",
      description: "Toggle lazy const",
      apply: Nano.gen(function*() {
        const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
        const initializer = node.initializer!

        if (ts.isArrowFunction(initializer) && initializer.parameters.length === 0) {
          // delete eventual closing bracked
          changeTracker.deleteRange(sourceFile, {
            pos: initializer.body.end,
            end: initializer.end
          })
          // remove () => {
          changeTracker.deleteRange(sourceFile, {
            pos: initializer.pos,
            end: initializer.body.pos
          })
          return
        }

        // adds () => before
        changeTracker.insertText(sourceFile, initializer.pos, " () =>")
      })
    })
  })
})
