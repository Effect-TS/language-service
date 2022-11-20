import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { isCurryArrow } from "@effect/language-service/utils"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/removeCurryArrow",
  description: "Remove arrow",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(isCurryArrow(ts)),
        Ch.head,
        O.map((node) => ({
          description: `Remove arrow ${AST.getHumanReadableName(sourceFile, node.body)}`,
          apply: T.gen(function*($) {
            const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))

            if (!ts.isCallExpression(node.body)) return
            const newNode = node.body.expression
            changeTracker.replaceNode(sourceFile, node, newNode)
          })
        }))
      )
    })
})
