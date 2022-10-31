import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { isCurryArrow } from "@effect/language-service/utils"

export default createRefactor({
  name: "effect/removeCurryArrow",
  description: "Remove arrow",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = AST.getNodesContainingRange(ts)(sourceFile, textRange)
      const curryArrowNodes = nodes.filter(isCurryArrow(ts))

      return curryArrowNodes.head.map(node => ({
        description: `Remove arrow ${AST.getHumanReadableName(sourceFile, node.body)}`,
        apply: Do($ => {
          const changeTracker = $(T.service(AST.ChangeTrackerApi))

          if (!ts.isCallExpression(node.body)) return
          const newNode = node.body.expression
          changeTracker.replaceNode(sourceFile, node, newNode)
        })
      }))
    })
})
