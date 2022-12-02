import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { getEffectModuleIdentifier, transformAsyncAwaitToEffectGen } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
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
          description: "Rewrite to Effect.gen with failures",
          apply: T.gen(function*($) {
            const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))
            const effectName = getEffectModuleIdentifier(ts)(sourceFile)

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

            const newDeclaration = (transformAsyncAwaitToEffectGen(ts)(node, effectName, (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectName),
                  "tryCatchPromise"
                ),
                undefined,
                [
                  ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, expression),
                  ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [ts.factory.createParameterDeclaration(undefined, undefined, "error")],
                    undefined,
                    undefined,
                    createErrorADT()
                  )
                ]
              )))

            changeTracker.replaceNode(sourceFile, node, newDeclaration)
          })
        }))
      )
    })
})
