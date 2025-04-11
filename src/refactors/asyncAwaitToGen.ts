import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as TypeParser from "../utils/TypeParser.js"

export const asyncAwaitToGen = createRefactor({
  name: "effect/asyncAwaitToGen",
  description: "Convert to Effect.gen",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      ReadonlyArray.filter((node) =>
        ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)
      ),
      ReadonlyArray.filter((node) => !!node.body),
      ReadonlyArray.filter((node) =>
        !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async)
      ),
      ReadonlyArray.head,
      Option.map((node) => ({
        kind: "refactor.rewrite.effect.asyncAwaitToGen",
        description: "Rewrite to Effect.gen",
        apply: (changeTracker) => {
          const isImportedEffectModule = TypeParser.importedEffectModule(
            ts,
            program.getTypeChecker()
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
        }
      }))
    )
})
