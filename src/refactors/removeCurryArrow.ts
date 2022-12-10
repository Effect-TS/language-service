import { createRefactor } from "@effect/language-service/refactors/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createRefactor({
  name: "effect/removeCurryArrow",
  description: "Remove arrow",
  apply: (ts) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(AST.isCurryArrow(ts)),
        Ch.head,
        O.map((node) => ({
          description: `Remove arrow ${AST.getHumanReadableName(sourceFile, node.body)}`,
          apply: (changeTracker) => {
            if (!ts.isCallExpression(node.body)) return
            const newNode = node.body.expression
            changeTracker.replaceNode(sourceFile, node, newNode)
          }
        }))
      )
})
