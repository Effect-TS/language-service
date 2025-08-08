import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ts from "typescript"
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

          const dataModuleIdentifierName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
            sourceFile,
            "effect",
            "Data"
          ) || "Data"

          let errorCount = 0
          const errors: Array<ts.ClassDeclaration> = []

          function createErrorADT() {
            errorCount++
            const errorName = "Error" + errorCount
            errors.push(tsUtils.createDataTaggedErrorDeclaration(dataModuleIdentifierName, errorName, [
              ts.factory.createPropertySignature(
                undefined,
                "cause",
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)
              )
            ]))
            return ts.factory.createNewExpression(
              ts.factory.createIdentifier(errorName),
              undefined,
              [ts.factory.createObjectLiteralExpression([
                ts.factory.createShorthandPropertyAssignment("cause")
              ])]
            )
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
                        [ts.factory.createParameterDeclaration(undefined, undefined, "cause")],
                        undefined,
                        undefined,
                        createErrorADT()
                      )
                    )
                  ])
                ]
              )
          )

          let beforeNode: ts.Node = node
          while (beforeNode.parent && !ts.isSourceFile(beforeNode.parent)) {
            beforeNode = beforeNode.parent
          }

          for (const error of errors) {
            changeTracker.insertNodeBefore(sourceFile, beforeNode, error, true)
          }

          changeTracker.replaceNode(sourceFile, node, newDeclaration)
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker)
      )
    })
  })
})
