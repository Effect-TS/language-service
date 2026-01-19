import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const globalErrorInEffectFailure = LSP.createDiagnostic({
  name: "globalErrorInEffectFailure",
  code: 35,
  description: "Warns when the global Error type is used in an Effect failure channel",
  severity: "warning",
  apply: Nano.fn("globalErrorInEffectFailure.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check for new expressions where the constructed type is the global Error type
      if (ts.isNewExpression(node)) {
        const newExpressionType = typeCheckerUtils.getTypeAtLocation(node)

        // Skip if not a global Error type
        if (!newExpressionType || !typeCheckerUtils.isGlobalErrorType(newExpressionType)) {
          continue
        }

        // Traverse up the parent nodes to find an Effect type
        let current: ts.Node | undefined = node.parent
        while (current) {
          // Check if current node's type is an Effect
          const currentType = typeCheckerUtils.getTypeAtLocation(current)
          if (currentType) {
            const effectTypeResult = yield* pipe(
              typeParser.effectType(currentType, current),
              Nano.option
            )

            if (effectTypeResult._tag === "Some") {
              const effectType = effectTypeResult.value
              // Unroll the union members of the failure type (E)
              const failureMembers = typeCheckerUtils.unrollUnionMembers(effectType.E)

              // Check if at least one member is exactly the global Error type
              const hasGlobalError = failureMembers.some((member) => typeCheckerUtils.isGlobalErrorType(member))

              if (hasGlobalError) {
                report({
                  location: node,
                  messageText:
                    `The global Error type is used in an Effect failure channel. It's not recommended to use the global Error type in Effect failures as they can get merged together. Instead, use tagged errors or custom errors with a discriminator property to get properly type-checked errors.`,
                  fixes: []
                })
              }
              // Stop traversing once we find an Effect type
              break
            }
          }
          current = current.parent
        }
      }
    }
  })
})
