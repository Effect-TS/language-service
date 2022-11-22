import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { getEffectModuleIdentifier, transformAsyncAwaitToEffectGen } from "@effect/language-service/utils"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { pipe } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"

export default createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isFunctionDeclaration),
        Ch.filter((node) => !!node.body),
        Ch.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
        Ch.head,
        O.map((node) => ({
          description: "Rewrite to Effect.gen",
          apply: T.gen(function*($) {
            const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))
            const effectName = getEffectModuleIdentifier(ts)(sourceFile)

            const newDeclaration = transformAsyncAwaitToEffectGen(ts)(node, effectName, (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectName),
                  "promise"
                ),
                undefined,
                [expression]
              ))

            changeTracker.replaceNode(sourceFile, node, newDeclaration)
          })
        }))
      )
    })
})
