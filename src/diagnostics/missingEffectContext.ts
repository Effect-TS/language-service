import * as ReadonlyArray from "effect/Array"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import { deterministicTypeOrder } from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const missingEffectContext = createDiagnostic({
  code: 1,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
      const sortTypes = ReadonlyArray.sort(deterministicTypeOrder(ts, typeChecker))

      const nodeToVisit: Array<ts.Node> = []
      const appendNodeToVisit = (node: ts.Node) => {
        nodeToVisit.push(node)
        return undefined
      }
      ts.forEachChild(sourceFile, appendNodeToVisit)

      while (nodeToVisit.length > 0) {
        const node = nodeToVisit.shift()!
        ts.forEachChild(node, appendNodeToVisit)

        const entries = yield* TypeCheckerApi.expectedAndRealType(node)
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
          const missingContext = yield* TypeCheckerApi.getMissingTypeEntriesInTargetType(
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
      }

      return effectDiagnostics
    })
})
