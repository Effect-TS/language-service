import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const asyncAwaitToGenTryPromise = LSP.createRefactor({
  name: "asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
  apply: Nano.fn("asyncAwaitToGenTryPromise.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter(
        (node) =>
          ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)
      ),
      Array.filter((node) => !!node.body),
      Array.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
      Array.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.asyncAwaitToGenTryPromise",
      description: "Rewrite to Effect.gen with failures",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          const effectModuleIdentifierName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Effect"
          ) || "Effect"

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

          const newDeclaration = tsUtils.transformAsyncAwaitToEffectGen(
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
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker)
      )
    })
  })
})
