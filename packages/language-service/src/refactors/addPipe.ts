import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { asPipeArguments, isPipeableCallExpression } from "@effect/language-service/utils"

export default createRefactor({
  name: "effect/addPipe",
  description: "Rewrite using pipe",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = AST.getNodesContainingRange(ts)(sourceFile, textRange)
      const pipeableCallExpressions = Chunk.from(nodes.reverse).filter(isPipeableCallExpression(ts))

      return pipeableCallExpressions.filter(AST.isNodeInRange(textRange)).head.map(node => ({
        description: `Rewrite ${AST.getHumanReadableName(sourceFile, node.expression)} to pipe`,
        apply: Do($ => {
          const changeTracker = $(T.service(AST.ChangeTrackerApi))
          const args = asPipeArguments(ts)(node)

          const newNode = ts.factory.createCallExpression(
            ts.factory.createIdentifier("pipe"),
            undefined,
            args.toArray
          )

          changeTracker.replaceNode(sourceFile, node, newNode)
        })
      }))
    })
})
