import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { isPipeCall } from "@effect/language-service/utils"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/removePipe",
  description: "Remove pipe call",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(isPipeCall(ts)),
        Ch.filter((node) => AST.isNodeInRange(textRange)(node.expression)),
        Ch.filter(
          (node) => node.arguments.length > 1
        ),
        Ch.head,
        O.map((node) => ({
          description: "Remove pipe call",
          apply: T.gen(function*($) {
            const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))

            const newNode = node.arguments.slice(1).reduce(
              (inner, exp) => ts.factory.createCallExpression(exp, undefined, [inner]),
              node.arguments[0]!
            )

            changeTracker.replaceNode(sourceFile, node, newNode)
          })
        }))
      )
    })
})
