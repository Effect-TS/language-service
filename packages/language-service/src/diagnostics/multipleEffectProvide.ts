import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const multipleEffectProvide = LSP.createDiagnostic({
  name: "multipleEffectProvide",
  code: 18,
  description: "Warns against chaining Effect.provide calls which can cause service lifecycle issues",
  severity: "warning",
  apply: Nano.fn("multipleEffectProvide.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const effectModuleIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    const layerModuleIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Layer"
    ) || "Layer"

    // Get all piping flows for the source file (including Effect.fn pipe transformations)
    const flows = yield* typeParser.pipingFlows(true)(sourceFile)

    for (const flow of flows) {
      let currentChunk = 0
      const previousLayers: Array<Array<{ layer: ts.Expression; node: ts.CallExpression }>> = [[]]

      // Look for consecutive Effect.provide transformations in the flow
      for (const transformation of flow.transformations) {
        // Skip if no args
        if (!transformation.args || transformation.args.length === 0) {
          // Non-provide transformation breaks the chain
          currentChunk++
          previousLayers.push([])
          continue
        }

        // Check if the callee is Effect.provide
        const isProvideCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("provide")(transformation.callee),
          Nano.option
        )

        if (Option.isSome(isProvideCall)) {
          const layer = transformation.args[0]
          const type = typeCheckerUtils.getTypeAtLocation(layer)
          const node = ts.findAncestor(transformation.callee, ts.isCallExpression)

          // Check if the argument is a Layer type and we found the call expression
          const isLayerType = type
            ? yield* pipe(
              typeParser.layerType(type, layer),
              Nano.option
            )
            : Option.none()

          if (Option.isSome(isLayerType) && node) {
            previousLayers[currentChunk].push({ layer, node })
          } else {
            // Not a layer, breaks the chain
            currentChunk++
            previousLayers.push([])
          }
        } else {
          // Non-provide transformation breaks the chain
          currentChunk++
          previousLayers.push([])
        }
      }

      // Report for each chunk with 2+ consecutive provide calls
      for (const chunk of previousLayers) {
        if (chunk.length < 2) continue
        report({
          location: chunk[0].node,
          messageText:
            "Avoid chaining Effect.provide calls, as this can lead to service lifecycle issues. Instead, merge layers and provide them in a single call.",
          fixes: [{
            fixName: "multipleEffectProvide_fix",
            description: "Combine into a single provide",
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
              changeTracker.deleteRange(sourceFile, {
                pos: ts.getTokenPosOfNode(chunk[0].node, sourceFile),
                end: chunk[chunk.length - 1].node.end
              })
              const newNode = ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectModuleIdentifier),
                  ts.factory.createIdentifier("provide")
                ),
                undefined,
                [ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(layerModuleIdentifier),
                    ts.factory.createIdentifier("mergeAll")
                  ),
                  undefined,
                  chunk.map((c) => c.layer)
                )]
              )
              changeTracker.insertNodeAt(sourceFile, ts.getTokenPosOfNode(chunk[0].node, sourceFile), newNode)
            })
          }]
        })
      }
    }
  })
})
