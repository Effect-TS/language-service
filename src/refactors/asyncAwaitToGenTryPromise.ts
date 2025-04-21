import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as TypeParser from "../utils/TypeParser.js"

export const asyncAwaitToGenTryPromise = createRefactor({
  name: "effect/asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter(
        (node) =>
          ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)
      ),
      ReadonlyArray.filter((node) => !!node.body),
      ReadonlyArray.filter((node) =>
        !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
      ),
      ReadonlyArray.head,
      Option.map((node) => ({
        kind: "refactor.rewrite.effect.asyncAwaitToGenTryPromise",
        description: "Rewrite to Effect.gen with failures",
        apply: (changeTracker) => {
          const effectModuleIdentifierName = AST.getEffectModuleIdentifierName(
            ts,
            program,
            sourceFile
          )

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

          const newDeclaration = AST.transformAsyncAwaitToEffectGen(
            ts
          )(
            node,
            effectModuleIdentifierName,
            (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectModuleIdentifierName),
                  "tryPromise"
                ),
                undefined,
                [
                  ts.factory.createObjectLiteralExpression([
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("try"),
                      ts.factory.createArrowFunction(
                        undefined,
                        undefined,
                        [],
                        undefined,
                        undefined,
                        expression
                      )
                    ),
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("catch"),
                      ts.factory.createArrowFunction(
                        undefined,
                        undefined,
                        [ts.factory.createParameterDeclaration(undefined, undefined, "error")],
                        undefined,
                        undefined,
                        createErrorADT()
                      )
                    )
                  ])
                ]
              )
          )

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        }
      }))
    )
})
