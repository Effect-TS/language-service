import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { getEffectModuleIdentifier, transformAsyncAwaitToEffectGen } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (ts) =>
    (sourceFile, textRange) =>
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isFunctionDeclaration),
        Ch.filter((node) => !!node.body),
        Ch.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
        Ch.head,
        O.map((node) => ({
          description: "Rewrite to Effect.gen",
          apply: (changeTracker) => {
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
          }
        }))
      )
})
