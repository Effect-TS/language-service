import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import { findLayerMergeAllDependencies } from "./layerMergeAllDependencies.js"

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
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
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
        if ((yield* findLayerMergeAllDependencies(argument.arguments)).length > 0) continue

        const startLine = sourceFile.getLineAndCharacterOfPosition(ts.getTokenPosOfNode(argument, sourceFile)).line
        const endLine = sourceFile.getLineAndCharacterOfPosition(argument.end).line
        const onlyArgument = argument.arguments.length === 1
          ? argument.arguments[0]
          : undefined
        let replacement: ts.Expression
        if (onlyArgument && ts.isSpreadElement(onlyArgument)) {
          const spreadExpression = onlyArgument.expression
          const spreadType = typeCheckerUtils.getTypeAtLocation(spreadExpression)
          if (
            spreadType &&
            typeChecker.isTupleType(spreadType) &&
            (spreadType as ts.TupleTypeReference).target.readonly
          ) {
            const tupleTarget = (spreadType as ts.TupleTypeReference).target
            const elementTypes = typeChecker.getTypeArguments(spreadType as ts.TypeReference)
            if (
              !ts.isIdentifier(spreadExpression) ||
              elementTypes.length === 0 ||
              tupleTarget.elementFlags.some((flag) => flag !== ts.ElementFlags.Required)
            ) {
              continue
            }
            replacement = ts.factory.createArrayLiteralExpression(
              elementTypes.map((_, index) =>
                ts.factory.createElementAccessExpression(
                  ts.factory.createIdentifier(spreadExpression.text),
                  index
                )
              )
            )
          } else {
            replacement = spreadExpression
          }
        } else {
          replacement = ts.factory.createArrayLiteralExpression(
            argument.arguments,
            startLine !== endLine
          )
        }

        report({
          location: argument.expression,
          messageText:
            "`Effect.provide` accepts an array of Layers directly, so this `Layer.mergeAll` call is redundant.",
          fixes: [{
            fixName: "redundantLayerMergeAllInProvide_fix",
            description: "Replace Layer.mergeAll with an array",
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
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
