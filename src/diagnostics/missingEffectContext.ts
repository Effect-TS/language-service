import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingEffectContext = LSP.createDiagnostic({
  name: "effect/missingEffectContext",
  code: 1,
  apply: Nano.fn("missingEffectContext.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeOrder = yield* TypeCheckerApi.deterministicTypeOrder

    const checkForMissingContextTypes = Nano.fn(
      "missingEffectContext.apply.checkForMissingContextTypes"
    )(function*(
      node: ts.Node,
      expectedType: ts.Type,
      valueNode: ts.Node,
      realType: ts.Type
    ) {
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
        realEffect.R,
        expectedEffect.R
      )
    })

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const sortTypes = ReadonlyArray.sort(typeOrder)

    const entries = yield* TypeCheckerApi.expectedAndRealType(sourceFile)
    for (const [node, expectedType, valueNode, realType] of entries) {
      const missingContext = yield* pipe(
        checkForMissingContextTypes(
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
            }' in the expected Effect context.`,
            fixes: []
          }
        )
      }
    }

    return effectDiagnostics
  })
})
