import * as ReadonlyArray from "effect/Array"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import { deterministicTypeOrder } from "../utils/AST.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingEffectContext = createDiagnostic({
  code: 1,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
    const sortTypes = ReadonlyArray.sort(deterministicTypeOrder(ts, typeChecker))

    const visit = (node: ts.Node) => {
      const entries = TypeCheckerApi.expectedAndRealType(ts, typeChecker)(node)
      for (const [node, expectedType, valueNode, realType] of entries) {
        // the expected type is an effect
        const expectedEffect = TypeParser.effectType(ts, typeChecker)(
          expectedType,
          node
        )
        if (Option.isNone(expectedEffect)) continue
        // the real type is an effect
        const realEffect = TypeParser.effectType(ts, typeChecker)(
          realType,
          valueNode
        )
        if (Option.isNone(realEffect)) continue
        // get the missing context types
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
                sortTypes(missingContext).map((_) => typeChecker.typeToString(_)).join(" | ")
              }' in the expected Effect context.`
            }
          )
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

    return effectDiagnostics
  }
})
