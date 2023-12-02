import * as AST from "../utils/AST.js"
import { pipe } from "../utils/Function.js"
import * as O from "../utils/Option.js"
import * as Ch from "../utils/ReadonlyArray.js"
import { createRefactor } from "./definition.js"

export default createRefactor({
  name: "effect/toggleLazyConst",
  description: "Toggle type annotation",
  apply: (ts) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      Ch.filter(ts.isVariableDeclaration),
      Ch.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      Ch.filter((node) =>
        !!node.initializer &&
        !(ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body))
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
          }
        })
      )
    )
})
