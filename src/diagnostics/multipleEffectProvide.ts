import { pipe } from "effect/Function"
import type ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const multipleEffectProvide = LSP.createDiagnostic({
  name: "multipleEffectProvide",
  code: 18,
  severity: "warning",
  apply: Nano.fn("multipleEffectProvide.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const effectModuleIdentifier = yield* pipe(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Effect"
      ),
      Nano.map((_) => _.text),
      Nano.orElse(() => Nano.succeed("Effect"))
    )

    const layerModuleIdentifier = yield* pipe(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Layer"
      ),
      Nano.map((_) => _.text),
      Nano.orElse(() => Nano.succeed("Layer"))
    )

    const parseEffectProvideLayer = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === "provide" &&
        node.arguments.length > 0
      ) {
        const layer = node.arguments[0]
        const type = typeChecker.getTypeAtLocation(layer)
        return pipe(
          typeParser.importedEffectModule(node.expression.expression),
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
            node: chunk[0].node,
            messageText:
              "Calling multiple subsequent times Effect.provide is an anti-pattern and can lead to service lifecycle issues. You should combine the layers and provide them once instead.",
            fixes: [{
              fixName: "multipleEffectProvide_fix",
              description: "Combine into a single provide",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                changeTracker.deleteRange(sourceFile, {
                  pos: chunk[0].node.getStart(sourceFile),
                  end: chunk[chunk.length - 1].node.getEnd()
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
                changeTracker.insertNodeAt(sourceFile, chunk[0].node.getStart(sourceFile), newNode)
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
