import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { isPipeCall } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/removePipe",
  description: "Remove pipe call",
  apply: (ts) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(isPipeCall(ts)),
        Ch.filter((node) => AST.isNodeInRange(textRange)(node.expression)),
        Ch.filter(
          (node) => node.arguments.length > 1
        ),
        Ch.head,
        O.map((node) => ({
          description: "Remove pipe call",
          apply: (changeTracker) => {
            const newNode = node.arguments.slice(1).reduce(
              (inner, exp) => ts.factory.createCallExpression(exp, undefined, [inner]),
              node.arguments[0]!
            )

            changeTracker.replaceNode(sourceFile, node, newNode)
          }
        }))
      )
})
