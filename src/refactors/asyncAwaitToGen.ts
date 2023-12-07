import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Ch from "effect/ReadonlyArray"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const asyncAwaitToGen = createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      Ch.filter(ts.isFunctionDeclaration),
      Ch.filter((node) => !!node.body),
      Ch.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
      Ch.head,
      O.map((node) => ({
        kind: "refactor.rewrite.effect.asyncAwaitToGen",
        description: "Rewrite to Effect.gen",
        apply: (changeTracker) => {
          const effectName = AST.getEffectModuleIdentifier(ts, program.getTypeChecker())(sourceFile)

          const newDeclaration = AST.transformAsyncAwaitToEffectGen(ts)(
            node,
            effectName,
            (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectName),
                  "promise"
                ),
                undefined,
                [expression]
              )
          )

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        }
      }))
    )
})
