import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import {
  isEffectSyncWithConstantCall,
  noSyncWithConstantMethodsMap
} from "@effect/language-service/diagnostics/noSyncWithConstant"
import { createRefactor } from "@effect/language-service/refactors/definition"
import { getEffectModuleIdentifier, isLiteralConstantValue } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as O from "@fp-ts/data/Option"

export default createRefactor({
  name: "effect/addPipe",
  description: "Rewrite using pipe",
  apply: (sourceFile, textRange) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))
      const effectIdentifier = getEffectModuleIdentifier(ts)(sourceFile)

      const nodes = pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.reverse,
        Ch.fromIterable,
        Ch.filter(AST.isNodeInRange(textRange))
      )

      for (const methodName of Object.keys(noSyncWithConstantMethodsMap)) {
        const suggestedMethodName: string = noSyncWithConstantMethodsMap[methodName]!
        const refactor = pipe(
          nodes,
          Ch.filter(isEffectSyncWithConstantCall(ts)(effectIdentifier, methodName)),
          Ch.head,
          O.map((node) => ({
            description: `Rewrite ${methodName} to ${suggestedMethodName}`,
            apply: T.gen(function*($) {
              const changeTracker = yield* $(T.service(AST.ChangeTrackerApi))
              const arg = node.arguments[0]
              if (ts.isArrowFunction(arg) && isLiteralConstantValue(ts)(arg.body)) {
                const newNode = ts.factory.updateCallExpression(
                  node,
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(effectIdentifier),
                    suggestedMethodName
                  ),
                  node.typeArguments,
                  ts.factory.createNodeArray([arg.body])
                )

                changeTracker.replaceNode(sourceFile, node, newNode)
              }
            })
          }))
        )
        if (O.isSome(refactor)) return refactor
      }

      return O.none
    })
})
