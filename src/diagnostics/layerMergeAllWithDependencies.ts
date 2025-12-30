import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const layerMergeAllWithDependencies = LSP.createDiagnostic({
  name: "layerMergeAllWithDependencies",
  code: 37,
  description:
    "Detects interdependencies in Layer.mergeAll calls where one layer provides a service that another layer requires",
  severity: "warning",
  apply: Nano.fn("layerMergeAllWithDependencies.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a call to Layer.mergeAll
      if (ts.isCallExpression(node)) {
        const checkLayerMergeAll = yield* pipe(
          typeParser.isNodeReferenceToEffectLayerModuleApi("mergeAll")(node.expression),
          Nano.orElse(() => Nano.void_)
        )

        if (checkLayerMergeAll) {
          // Get all layer arguments
          const layerArgs = node.arguments

          if (layerArgs.length > 1) {
            // Parse all layers to extract their ROut (provided) and RIn (required) types
            const layerInfos: Array<{
              arg: ts.Expression
              requirementsType: ts.Type
            }> = []

            // Map of actually provided types -> layer argument that provides it
            const actuallyProvidedMap = new Map<ts.Type, ts.Expression>()

            for (const arg of layerArgs) {
              const argType = typeCheckerUtils.getTypeAtLocation(arg)
              if (!argType) continue

              const layerTypeParsedOption = yield* Nano.option(typeParser.layerType(argType, arg))
              if (Option.isNone(layerTypeParsedOption)) continue

              const layerTypeParsed = layerTypeParsedOption.value

              // Unroll union members for provided types (ROut)
              const providedMembers = typeCheckerUtils.unrollUnionMembers(layerTypeParsed.ROut)

              // Filter out pass-through types: types that are both provided and required
              // Add only actually provided types to the map
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

            // Check for interdependencies
            // Build a map of provider -> layers that depend on it
            const providerToConsumers = new Map<
              ts.Expression,
              Array<{ consumer: ts.Expression; providedType: ts.Type }>
            >()

            for (const layer of layerInfos) {
              // Check if any of the actually provided types satisfy this layer's requirements
              for (const [providedType, providerArg] of actuallyProvidedMap) {
                // Skip if this is the same layer
                if (providerArg === layer.arg) continue

                // Check if this provided type is assignable to the layer's requirements type
                if (typeChecker.isTypeAssignableTo(providedType, layer.requirementsType)) {
                  const consumers = providerToConsumers.get(providerArg) || []
                  consumers.push({ consumer: layer.arg, providedType })
                  providerToConsumers.set(providerArg, consumers)
                }
              }
            }

            // Report on providers that have consumers
            for (const [providerArg, consumers] of providerToConsumers) {
              const providedTypes = Array.from(new Set(consumers.map((c) => typeChecker.typeToString(c.providedType))))
                .join(", ")

              report({
                location: providerArg,
                messageText:
                  `This layer provides ${providedTypes} which is required by another layer in the same Layer.mergeAll call. Layer.mergeAll creates layers in parallel, so dependencies between layers will not be satisfied. Consider moving this layer into a Layer.provideMerge after the Layer.mergeAll.`,
                fixes: []
              })
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
