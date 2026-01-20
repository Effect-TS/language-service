import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"

export const missingLayerContext = LSP.createDiagnostic({
  name: "missingLayerContext",
  code: 38,
  description: "Reports missing service requirements in Layer context channel",
  severity: "error",
  apply: Nano.fn("missingLayerContext.apply")(function*(sourceFile, report) {
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
          typeParser.layerType(expectedType, node),
          typeParser.layerType(realType, valueNode)
        ),
        Nano.map(([expectedLayer, realLayer]) =>
          typeCheckerUtils.getMissingTypeEntriesInTargetType(
            realLayer.RIn,
            expectedLayer.RIn
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
                  }' in the expected Layer context.`,
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
