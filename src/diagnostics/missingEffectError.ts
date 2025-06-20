import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missingEffectError = LSP.createDiagnostic({
  name: "missingEffectError",
  code: 1,
  apply: Nano.fn("missingEffectError.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerCache = yield* Nano.service(TypeCheckerApi.TypeCheckerApiCache)
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
          pipe(
            TypeCheckerApi.getMissingTypeEntriesInTargetType(
              realEffect.E,
              expectedEffect.E
            ),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
          )
        )
      )

    const sortTypes = ReadonlyArray.sort(typeOrder)

    return {
      [ts.SyntaxKind.SourceFile]: (sourceFile) =>
        Nano.gen(function*() {
          const entries = yield* pipe(
            TypeCheckerApi.expectedAndRealType(sourceFile),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
            Nano.provideService(TypeCheckerApi.TypeCheckerApiCache, typeCheckerCache)
          )
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
              report(
                {
                  node,
                  category: ts.DiagnosticCategory.Error,
                  messageText: `Missing '${
                    sortTypes(missingContext).map((_) => typeChecker.typeToString(_)).join(" | ")
                  }' in the expected Effect errors.`,
                  fixes: []
                }
              )
            }
          }
        })
    }
  })
})
