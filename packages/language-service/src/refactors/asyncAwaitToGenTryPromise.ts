import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { findModuleImportIdentifierName, transformAsyncAwaitToEffectGen } from "@effect/language-service/utils"

export default createRefactor({
  name: "effect/asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
  apply: (sourceFile, textRange) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = (AST.getNodesContainingRange(ts)(sourceFile, textRange))

      return nodes.filter(ts.isFunctionDeclaration).filter(node => !!node.body).filter(node =>
        !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
      ).head.map(node => ({
        description: "Rewrite to Effect.gen with failures",
        apply: Do($ => {
          const changeTracker = $(T.service(AST.ChangeTrackerApi))
          const importedEffectName = (findModuleImportIdentifierName(ts)(sourceFile, "@effect/core/io/Effect"))
          const effectName = importedEffectName.getOrElse("Effect")

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

          const newDeclaration = $(transformAsyncAwaitToEffectGen(node, effectName, expression =>
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
    })
})
