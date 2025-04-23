import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const missingEffectError = LSP.createDiagnostic({
  code: 1,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const typeOrder = yield* TypeCheckerApi.deterministicTypeOrder

      function checkForMissingErrorTypes(
        node: ts.Node,
        expectedType: ts.Type,
        valueNode: ts.Node,
        realType: ts.Type
      ) {
        return Nano.gen(function*() {
          // the expected type is an effect
          const expectedEffect = yield* (TypeParser.effectType(
            expectedType,
            node
          ))
          // the real type is an effect
          const realEffect = yield* (TypeParser.effectType(
            realType,
            valueNode
          ))
          // get the missing types
          return yield* TypeCheckerApi.getMissingTypeEntriesInTargetType(
            realEffect.E,
            expectedEffect.E
          )
        })
      }

      const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
      const sortTypes = ReadonlyArray.sort(typeOrder)

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
          const missingContext = yield* pipe(
            checkForMissingErrorTypes(
              node,
              expectedType,
              valueNode,
              realType
            ),
            Nano.orElse(() => Nano.succeed([]))
          )
          if (missingContext.length > 0) {
            effectDiagnostics.push(
              {
                node,
                category: ts.DiagnosticCategory.Error,
                messageText: `Missing '${
                  sortTypes(missingContext).map((_) => typeChecker.typeToString(_)).join(" | ")
                }' in the expected Effect errors.`
              }
            )
          }
        }
      }

      return effectDiagnostics
    })
})
