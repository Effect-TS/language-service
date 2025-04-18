import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const toggleLazyConst = createRefactor({
  name: "effect/toggleLazyConst",
  description: "Toggle type annotation",
  apply: (ts) => (sourceFile, textRange) =>
    pipe(
      AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter(ts.isVariableDeclaration),
      ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.name)),
      ReadonlyArray.filter((node) =>
        !!node.initializer &&
        !(ts.isArrowFunction(node.initializer) && ts.isBlock(node.initializer.body))
      ),
      ReadonlyArray.head,
      Option.map(
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
