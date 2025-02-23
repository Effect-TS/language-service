import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as Parsers from "../utils/Parsers.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"

export const missingContextOrError = createDiagnostic({
  code: 1,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []

    const visit = (node: ts.Node) => {
      const entries = Parsers.expectedAndRealType(ts, typeChecker)(node)
      for (const [node, expectedType, valueNode, realType] of entries) {
        const expectedEffect = Parsers.effectTypeArguments(ts, typeChecker)(
          expectedType,
          node
        )
        const realEffect = Parsers.effectTypeArguments(ts, typeChecker)(realType, valueNode)
        if (Option.isSome(expectedEffect) && Option.isSome(realEffect)) {
          const missingContext = TypeCheckerApi.getMissingTypeEntriesInTargetType(
            ts,
            typeChecker
          )(
            realEffect.value.R,
            expectedEffect.value.R
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
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

    return effectDiagnostics
  }
})
