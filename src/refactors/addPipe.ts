import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { asPipeArguments, isPipeableCallExpression } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/addPipe",
  description: "Rewrite using pipe",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.reverse,
        Ch.fromIterable,
        Ch.filter(AST.isNodeInRange(textRange)),
        Ch.filter(isPipeableCallExpression(ts)),
        Ch.head,
        O.map((node) => ({
          description: `Rewrite ${AST.getHumanReadableName(sourceFile, node.expression)} to pipe`,
          apply: T.gen(function*($) {
            const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))
            const args = asPipeArguments(ts)(node)

            const newNode = ts.factory.createCallExpression(
              ts.factory.createIdentifier("pipe"),
              undefined,
              Array.from(args)
            )

            changeTracker.replaceNode(sourceFile, node, newNode)
          })
        }))
      )
    })
})
