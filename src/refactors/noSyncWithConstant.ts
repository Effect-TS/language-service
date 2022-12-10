import {
  isEffectSyncWithConstantCall,
  noSyncWithConstantMethodsMap
} from "@effect/language-service/diagnostics/noSyncWithConstant"
import { createRefactor } from "@effect/language-service/refactors/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createRefactor({
  name: "effect/addPipe",
  description: "Rewrite using pipe",
  apply: (ts) =>
    (sourceFile, textRange) => {
      const effectIdentifier = AST.getEffectModuleIdentifier(ts)(sourceFile)

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
            apply: (changeTracker: ts.textChanges.ChangeTracker) => {
              const arg = node.arguments[0]
              if (ts.isArrowFunction(arg) && AST.isLiteralConstantValue(ts)(arg.body)) {
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
            }
          }))
        )
        if (O.isSome(refactor)) return refactor
      }

      return O.none
    }
})
