import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"

export const missingEffectContext = LSP.createDiagnostic({
  name: "missingEffectContext",
  code: 1,
  description: "Reports missing service requirements in Effect context channel",
  severity: "error",
  apply: Nano.fn("missingEffectContext.apply")(function*(sourceFile, report) {
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const checkForMissingContextTypes = (
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
        Nano.map(([expectedEffect, realEffect]) =>
          typeCheckerUtils.getMissingTypeEntriesInTargetType(
            realEffect.R,
            expectedEffect.R
          )
        )
      )

    const sortTypes = ReadonlyArray.sort(typeCheckerUtils.deterministicTypeOrder)

    const entries = LSP.getEffectLspPatchSourceFileMetadata(sourceFile)?.relationErrors ||
      typeCheckerUtils.expectedAndRealType(sourceFile)
    for (const [node, expectedType, valueNode, realType] of entries) {
      // if the types are different, check for missing context types
      if (expectedType !== realType) {
        yield* pipe(
          checkForMissingContextTypes(
            node,
            expectedType,
            valueNode,
            realType
          ),
          Nano.map((missingTypes) =>
            missingTypes.length > 0 ?
              report(
                {
                  location: node,
                  messageText: `Missing '${
                    sortTypes(missingTypes).map((_) => typeChecker.typeToString(_)).join(" | ")
                  }' in the expected Effect context.`,
                  fixes: []
                }
              )
              : undefined
          ),
          Nano.ignore
        )
      }
    }
  })
})
