import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const asyncAwaitToGen = createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const maybeNode = pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter((node) =>
          ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)
        ),
        ReadonlyArray.filter((node) => !!node.body),
        ReadonlyArray.filter((node) =>
          !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
        ),
        ReadonlyArray.head
      )

      if (Option.isNone(maybeNode)) return yield* Nano.fail(new RefactorNotApplicableError())
      const node = maybeNode.value

      return ({
        kind: "refactor.rewrite.effect.asyncAwaitToGen",
        description: "Rewrite to Effect.gen",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          const isImportedEffectModule = TypeParser.importedEffectModule(
            ts,
            typeChecker
          )
          const effectModuleIdentifierName = pipe(
            AST.findImportedModuleIdentifier(ts)((node) =>
              Option.isSome(isImportedEffectModule(node))
            )(sourceFile),
            Option.map((node) => node.text),
            Option.getOrElse(() => "Effect")
          )

          const newDeclaration = AST.transformAsyncAwaitToEffectGen(
            ts
          )(
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
        })
      })
    })
})
