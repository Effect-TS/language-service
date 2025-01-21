import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const asyncAwaitToGen = createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter(ts.isFunctionDeclaration),
      ReadonlyArray.filter((node) => !!node.body),
      ReadonlyArray.filter((node) =>
        !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
      ),
      ReadonlyArray.head,
      Option.map((node) => ({
        kind: "refactor.rewrite.effect.asyncAwaitToGen",
        description: "Rewrite to Effect.gen",
        apply: (changeTracker) => {
          const effectName = AST.getEffectModuleIdentifier(ts, program.getTypeChecker())(sourceFile)

          const newDeclaration = AST.transformAsyncAwaitToEffectGen(
            ts
          )(
            node,
            effectName,
            (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectName),
                  "promise"
                ),
                undefined,
                [
                  ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    undefined,
                    expression
                  )
                ]
              )
          )

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        }
      }))
    )
})
