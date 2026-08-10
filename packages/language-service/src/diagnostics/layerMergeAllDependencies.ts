import * as Option from "effect/Option"
import type ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export interface LayerMergeAllDependency {
  readonly provider: ts.Expression
  readonly providedTypes: string
}

export const findLayerMergeAllDependencies = Nano.fn("findLayerMergeAllDependencies")(function*(
  layerArgs: ReadonlyArray<ts.Expression>
) {
  if (layerArgs.length <= 1) return []

  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  const layerInfos: Array<{
    arg: ts.Expression
    requirementsType: ts.Type
  }> = []
  const actuallyProvidedMap = new Map<ts.Type, ts.Expression>()

  for (const arg of layerArgs) {
    const argType = typeCheckerUtils.getTypeAtLocation(arg)
    if (!argType) continue

    const layerTypeParsedOption = yield* Nano.option(typeParser.layerType(argType, arg))
    if (Option.isNone(layerTypeParsedOption)) continue

    const layerTypeParsed = layerTypeParsedOption.value
    const providedMembers = typeCheckerUtils.unrollUnionMembers(layerTypeParsed.ROut)

    for (const providedType of providedMembers) {
      if (providedType.flags & ts.TypeFlags.Never) continue
      const isPassThrough = typeChecker.isTypeAssignableTo(providedType, layerTypeParsed.RIn)
      if (!isPassThrough) {
        actuallyProvidedMap.set(providedType, arg)
      }
    }

    layerInfos.push({
      arg,
      requirementsType: layerTypeParsed.RIn
    })
  }

  const providerToTypes = new Map<ts.Expression, Set<string>>()
  for (const layer of layerInfos) {
    for (const [providedType, provider] of actuallyProvidedMap) {
      if (provider === layer.arg) continue
      if (!typeChecker.isTypeAssignableTo(providedType, layer.requirementsType)) continue

      const providedTypes = providerToTypes.get(provider) ?? new Set<string>()
      providedTypes.add(typeChecker.typeToString(providedType))
      providerToTypes.set(provider, providedTypes)
    }
  }

  return Array.from(providerToTypes, ([provider, providedTypes]) => ({
    provider,
    providedTypes: Array.from(providedTypes).join(", ")
  }))
})
