import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { transformAsyncAwaitToEffectGen } from "@effect/language-service/utils"

export default createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = $(AST.getNodesContainingRange(sourceFile, textRange))

      return nodes.filter(ts.isFunctionDeclaration).filter(node => !!node.body).filter(node =>
        !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
      ).head.map(node => ({
        description: "Rewrite to Effect.gen",
        apply: Do($ => {
          const changeTracker = $(T.service(AST.ChangeTrackerApi))

          const newDeclaration = $(transformAsyncAwaitToEffectGen(node, expression =>
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("Effect"),
                "promise"
              ),
              undefined,
              [expression]
            )))

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        })
      }))
    })
})
