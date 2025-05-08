import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const toggleLazyConst = LSP.createRefactor({
  name: "effect/toggleLazyConst",
  description: "Toggle lazy const",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

      const maybeNode = pipe(
        yield* AST.getAncestorNodesInRange(sourceFile, textRange),
        ReadonlyArray.filter(ts.isVariableDeclaration),
        ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
        ReadonlyArray.filter((node) =>
          !!node.initializer &&
          !(ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body))
        ),
        ReadonlyArray.head
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
