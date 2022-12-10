import { createRefactor } from "@effect/language-service/refactors/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createRefactor({
  name: "effect/addPipe",
  description: "Rewrite using pipe",
  apply: (ts) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.reverse,
        Ch.fromIterable,
        Ch.filter(AST.isNodeInRange(textRange)),
        Ch.filter(AST.isPipeableCallExpression(ts)),
        Ch.head,
        O.map((node) => ({
          description: `Rewrite ${AST.getHumanReadableName(sourceFile, node.expression)} to pipe`,
          apply: (changeTracker: ts.textChanges.ChangeTracker) => {
            const args = AST.asPipeArguments(ts)(node)

            const newNode = ts.factory.createCallExpression(
              ts.factory.createIdentifier("pipe"),
              undefined,
              Array.from(args)
            )

            changeTracker.replaceNode(sourceFile, node, newNode)
          }
        }))
      )
})
