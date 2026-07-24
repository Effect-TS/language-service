import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const redundantLayerMergeAllInProvide = LSP.createDiagnostic({
  name: "redundantLayerMergeAllInProvide",
  code: 77,
  description: "Replaces direct Layer.mergeAll arguments to Effect.provide with an array of layers",
  group: "style",
  severity: "suggestion",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("redundantLayerMergeAllInProvide.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodesToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodesToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodesToVisit.length > 0) {
      const node = nodesToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isCallExpression(node)) continue

      const isEffectProvide = yield* pipe(
        typeParser.isNodeReferenceToEffectModuleApi("provide")(node.expression),
        Nano.orUndefined
      )
      if (!isEffectProvide) continue

      for (const argument of node.arguments) {
        if (!ts.isCallExpression(argument)) continue

        const isLayerMergeAll = yield* pipe(
          typeParser.isNodeReferenceToEffectLayerModuleApi("mergeAll")(argument.expression),
          Nano.orUndefined
        )
        if (!isLayerMergeAll) continue

        const startLine = sourceFile.getLineAndCharacterOfPosition(ts.getTokenPosOfNode(argument, sourceFile)).line
        const endLine = sourceFile.getLineAndCharacterOfPosition(argument.end).line

        report({
          location: argument.expression,
          messageText:
            "`Effect.provide` accepts an array of Layers directly, so this `Layer.mergeAll` call is redundant.",
          fixes: [{
            fixName: "redundantLayerMergeAllInProvide_fix",
            description: "Replace Layer.mergeAll with an array",
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
              const onlyArgument = argument.arguments.length === 1
                ? argument.arguments[0]
                : undefined
              const replacement = onlyArgument && ts.isSpreadElement(onlyArgument)
                ? onlyArgument.expression
                : ts.factory.createArrayLiteralExpression(
                  argument.arguments,
                  startLine !== endLine
                )
              changeTracker.replaceNode(
                sourceFile,
                argument,
                replacement
              )
            })
          }]
        })
      }
    }
  })
})
