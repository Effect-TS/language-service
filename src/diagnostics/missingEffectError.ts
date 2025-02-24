import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingEffectError = createDiagnostic({
  code: 2,
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

          const missingErrorTypes = TypeCheckerApi.getMissingTypeEntriesInTargetType(
            ts,
            typeChecker
          )(
            realEffect.E,
            expectedEffect.E
          )
          if (missingErrorTypes.length > 0) {
            effectDiagnostics.push(
              {
                node,
                category: ts.DiagnosticCategory.Error,
                messageText: `Missing '${
                  missingErrorTypes.map((_) => typeChecker.typeToString(_)).join(" | ")
                }' in the expected Effect errors.`
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
