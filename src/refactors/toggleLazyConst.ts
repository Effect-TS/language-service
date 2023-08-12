import { createRefactor } from "@effect/language-service/refactors/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createRefactor({
  name: "effect/toggleLazyConst",
  description: "Toggle type annotation",
  apply: (ts) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isVariableDeclaration),
        Ch.filter((node) => AST.isNodeInRange(textRange)(node.name)),
        Ch.filter((node) =>
          !!node.initializer && !(ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body))
        ),
        Ch.head,
        O.map(
          (node) => ({
            kind: "refactor.rewrite.effect.toggleLazyConst",
            description: "Toggle lazy const",
            apply: (changeTracker) => {
              const initializer = node.initializer!

              if (ts.isArrowFunction(initializer) && initializer.parameters.length === 0) {
                // delete eventual closing bracked
                changeTracker.deleteRange(sourceFile, { pos: initializer.body.end, end: initializer.end })
                // remove () => {
                changeTracker.deleteRange(sourceFile, { pos: initializer.pos, end: initializer.body.pos })
                return
              }

              // adds () => before
              changeTracker.insertText(sourceFile, initializer.pos, " () =>")
            }
          })
        )
      )
})
