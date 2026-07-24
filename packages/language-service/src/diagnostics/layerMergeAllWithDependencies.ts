import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import { findLayerMergeAllDependencies } from "./layerMergeAllDependencies.js"

export const layerMergeAllWithDependencies = LSP.createDiagnostic({
  name: "layerMergeAllWithDependencies",
  code: 37,
  description:
    "Detects interdependencies in Layer.mergeAll calls where one layer provides a service that another layer requires",
  group: "antipattern",
  severity: "warning",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("layerMergeAllWithDependencies.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const layerModuleIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Layer"
    ) || "Layer"

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
          const layerArgs = node.arguments
          const dependencies = yield* findLayerMergeAllDependencies(layerArgs)
          for (const dependency of dependencies) {
            const providerArg = dependency.provider
            const providedTypes = dependency.providedTypes
            report({
              location: providerArg,
              messageText:
                `This layer provides ${providedTypes} which is required by another layer in the same Layer.mergeAll call. Layer.mergeAll creates layers in parallel, so dependencies between layers will not be satisfied. Consider moving this layer into a Layer.provideMerge after the Layer.mergeAll.`,
              fixes: [{
                fixName: "layerMergeAllWithDependencies_fix",
                description: "Move layer to Layer.provideMerge",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Find the index of the provider argument
                  const providerIndex = layerArgs.indexOf(providerArg as ts.Expression)
                  if (providerIndex === -1) return

                  // Step 1: Delete the provider argument from Layer.mergeAll
                  // Need to handle commas correctly
                  const providerArgNode = providerArg as ts.Expression
                  if (providerIndex === 0 && layerArgs.length > 1) {
                    // First argument - delete including the trailing comma
                    changeTracker.deleteRange(sourceFile, {
                      pos: providerArgNode.pos,
                      end: layerArgs[1].pos
                    })
                  } else if (providerIndex > 0) {
                    // Not first argument - delete including the preceding comma
                    changeTracker.deleteRange(sourceFile, {
                      pos: layerArgs[providerIndex - 1].end,
                      end: providerArgNode.end
                    })
                  }

                  // Step 2: Insert .pipe(Layer.provideMerge(providerArg)) at the end
                  const provideMergeCall = ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier(layerModuleIdentifier),
                      ts.factory.createIdentifier("provideMerge")
                    ),
                    undefined,
                    [providerArgNode]
                  )

                  changeTracker.insertNodeAt(sourceFile, node.end, provideMergeCall, {
                    prefix: ".pipe("
                  })
                  changeTracker.insertText(sourceFile, node.end, ")")
                })
              }]
            })
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
