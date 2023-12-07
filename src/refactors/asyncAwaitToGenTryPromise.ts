import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Ch from "effect/ReadonlyArray"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const asyncAwaitToGenTryPromise = createRefactor({
  name: "effect/asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      Ch.filter(ts.isFunctionDeclaration),
      Ch.filter((node) => !!node.body),
      Ch.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
      Ch.head,
      O.map((node) => ({
        kind: "refactor.rewrite.effect.asyncAwaitToGenTryPromise",
        description: "Rewrite to Effect.gen with failures",
        apply: (changeTracker) => {
          const effectName = AST.getEffectModuleIdentifier(ts, program.getTypeChecker())(sourceFile)

          let errorCount = 0

          function createErrorADT() {
            errorCount++
            return ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                "_tag",
                ts.factory.createAsExpression(
                  ts.factory.createStringLiteral("Error" + errorCount),
                  ts.factory.createTypeReferenceNode("const")
                )
              ),
              ts.factory.createShorthandPropertyAssignment("error")
            ])
          }

          const newDeclaration = AST.transformAsyncAwaitToEffectGen(ts)(
            node,
            effectName,
            (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectName),
                  "tryCatchPromise"
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
                  ),
                  ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [ts.factory.createParameterDeclaration(undefined, undefined, "error")],
                    undefined,
                    undefined,
                    createErrorADT()
                  )
                ]
              )
          )

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        }
      }))
    )
})
