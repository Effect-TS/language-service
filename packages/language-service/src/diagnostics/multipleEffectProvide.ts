import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import { parseEffectProvideLayerArgument } from "./effectProvideLayerArgument.js"

export const multipleEffectProvide = LSP.createDiagnostic({
  name: "multipleEffectProvide",
  code: 18,
  description: "Warns against chaining Effect.provide calls which can cause service lifecycle issues",
  group: "antipattern",
  severity: "warning",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("multipleEffectProvide.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const supportedEffect = typeParser.supportedEffect()

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
      const previousLayers: Array<
        Array<{
          layers: ReadonlyArray<ts.Expression>
          node: ts.CallExpression
        }>
      > = [[]]

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
          const options = transformation.args[1]
          const isLocalProvide = supportedEffect === "v4" &&
            options !== undefined &&
            ts.isObjectLiteralExpression(options) &&
            options.properties.some((property) =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              ts.idText(property.name) === "local" &&
              property.initializer.kind === ts.SyntaxKind.TrueKeyword
            )

          if (isLocalProvide) {
            currentChunk++
            previousLayers.push([])
            continue
          }

          const layer = transformation.args[0]
          const node = ts.findAncestor(transformation.callee, ts.isCallExpression)
          const layers = yield* pipe(
            parseEffectProvideLayerArgument(layer),
            Nano.option
          )

          if (Option.isSome(layers) && node) {
            previousLayers[currentChunk].push({ layers: layers.value, node })
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
            "This expression chains multiple `Effect.provide` calls. Providing Layers in multiple calls in a chain can break service lifecycle behavior compared with a single combined provide with merged layers.",
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
                  chunk.flatMap((c) => c.layers)
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
