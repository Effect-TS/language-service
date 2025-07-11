import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const asyncAwaitToGenTryPromise = LSP.createRefactor({
  name: "asyncAwaitToGenTryPromise",
  description: "Convert to Effect.gen with failures",
  apply: Nano.fn("asyncAwaitToGenTryPromise.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeNode = pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.filter(
        (node) =>
          ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)
      ),
      ReadonlyArray.filter((node) => !!node.body),
      ReadonlyArray.filter((node) => !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)),
      ReadonlyArray.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.asyncAwaitToGenTryPromise",
      description: "Rewrite to Effect.gen with failures",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          const effectModuleIdentifierName = Option.match(
            yield* Nano.option(
              AST.findImportedModuleIdentifier(
                sourceFile,
                (node) =>
                  pipe(
                    typeParser.importedEffectModule(node),
                    Nano.option,
                    Nano.map(Option.isSome)
                  )
              )
            ),
            {
              onNone: () => "Effect",
              onSome: (node) => node.text
            }
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

          const newDeclaration = yield* AST.transformAsyncAwaitToEffectGen(
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
