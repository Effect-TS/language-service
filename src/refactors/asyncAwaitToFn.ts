import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const asyncAwaitToFn = LSP.createRefactor({
  name: "asyncAwaitToFn",
  description: "Convert to Effect.fn",
  apply: Nano.fn("asyncAwaitToFn.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((node) =>
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
      kind: "refactor.rewrite.effect.asyncAwaitToFn",
      description: "Rewrite to Effect.fn",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          const effectModuleIdentifierName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Effect"
          ) || "Effect"

          const newDeclaration = tsUtils.transformAsyncAwaitToEffectFn(
            node,
            effectModuleIdentifierName,
            (expression) =>
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectModuleIdentifierName),
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
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker)
      )
    })
  })
})
