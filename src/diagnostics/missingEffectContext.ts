import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingEffectContext = createDiagnostic({
  code: 1,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []

    const visit = (node: ts.Node) => {
      const entries = TypeParser.expectedAndRealType(ts, typeChecker)(node)
      for (const [node, expectedType, valueNode, realType] of entries) {
        Option.gen(function*() {
          const expectedEffect = yield* TypeParser.effectTypeArguments(ts, typeChecker)(
            expectedType,
            node
          )
          const realEffect = yield* TypeParser.effectTypeArguments(ts, typeChecker)(
            realType,
            valueNode
          )

          const missingContext = TypeCheckerApi.getMissingTypeEntriesInTargetType(
            ts,
            typeChecker
          )(
            realEffect.R,
            expectedEffect.R
          )
          if (missingContext.length > 0) {
            effectDiagnostics.push(
              {
                node,
                category: ts.DiagnosticCategory.Error,
                messageText: `Missing '${
                  missingContext.map((_) => typeChecker.typeToString(_)).join(" | ")
                }' in the expected Effect context.`
              }
            )
          }
        })
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

    return effectDiagnostics
  }
})
