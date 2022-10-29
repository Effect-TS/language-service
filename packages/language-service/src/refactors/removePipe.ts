import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { isPipeCall } from "@effect/language-service/utils"

export default createRefactor({
  name: "effect/removePipe",
  description: "Remove pipe call",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = $(AST.getNodesContainingRange(sourceFile, textRange))
      const pipeCalls = $(Effect.filterPar(nodes, isPipeCall))

      return pipeCalls.filter(ts.isCallExpression).filter(node =>
        node.expression.pos <= textRange.pos && node.expression.end >= textRange.end
      ).filter(node => node.arguments.length > 1).head.map(node => ({
        description: "Remove pipe call",
        apply: Do($ => {
          const changeTracker = $(T.service(AST.ChangeTrackerApi))

          const newNode = node.arguments.slice(1).reduce(
            (inner, exp) => ts.factory.createCallExpression(exp, undefined, [inner]),
            node.arguments[0]!
          )

          changeTracker.replaceNode(sourceFile, node, newNode)
        })
      }))
    })
})
