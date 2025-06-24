import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"

export const missingEffectError = LSP.createDiagnostic({
  name: "missingEffectError",
  code: 1,
  severity: "error",
  apply: Nano.fn("missingEffectError.apply")(function*(sourceFile, report) {
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeOrder = yield* TypeCheckerApi.deterministicTypeOrder

    const checkForMissingErrorTypes = (
      node: ts.Node,
      expectedType: ts.Type,
      valueNode: ts.Node,
      realType: ts.Type
    ) =>
      pipe(
        Nano.all(
          typeParser.effectType(expectedType, node),
          typeParser.effectType(realType, valueNode)
        ),
        Nano.flatMap(([expectedEffect, realEffect]) =>
          TypeCheckerApi.getMissingTypeEntriesInTargetType(
            realEffect.E,
            expectedEffect.E
          )
        )
      )

    const sortTypes = ReadonlyArray.sort(typeOrder)

    const entries = yield* TypeCheckerApi.expectedAndRealType(sourceFile)
    for (const [node, expectedType, valueNode, realType] of entries) {
      // if the types are different, check for missing error types
      if (expectedType !== realType) {
        yield* pipe(
          checkForMissingErrorTypes(
            node,
            expectedType,
            valueNode,
            realType
          ),
          Nano.map((missingTypes) =>
            missingTypes.length > 0 ?
              report(
                {
                  node,
                  messageText: `Missing '${
                    sortTypes(missingTypes).map((_) => typeChecker.typeToString(_)).join(" | ")
                  }' in the expected Effect errors.`,
                  fixes: []
                }
              ) :
              undefined
          ),
          Nano.ignore
        )
      }
    }
  })
})
