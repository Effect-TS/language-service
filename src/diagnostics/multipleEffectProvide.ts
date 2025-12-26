import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
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
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
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

    const parseEffectProvideLayer = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.arguments.length > 0
      ) {
        const layer = node.arguments[0]
        const type = typeChecker.getTypeAtLocation(layer)
        return pipe(
          typeParser.isNodeReferenceToEffectModuleApi("provide")(node.expression),
          Nano.flatMap(() => typeParser.layerType(type, layer)),
          Nano.map(() => ({ layer, node })),
          Nano.orElse(() => Nano.void_)
        )
      }
      return Nano.void_
    }

    const parsePipeCall = (node: ts.Node) =>
      Nano.gen(function*() {
        const { args } = yield* typeParser.pipeCall(node)
        let currentChunk = 0
        const previousLayers: Array<Array<{ layer: ts.Expression; node: ts.CallExpression }>> = [[]]
        for (const pipeArg of args) {
          const parsedProvide = yield* (parseEffectProvideLayer(pipeArg))
          if (parsedProvide) {
            previousLayers[currentChunk].push(parsedProvide)
          } else {
            currentChunk++
            previousLayers.push([])
          }
        }
        // report for each chunk
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
      })

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (ts.isCallExpression(node)) {
        yield* pipe(parsePipeCall(node), Nano.ignore)
      }
    }
  })
})
