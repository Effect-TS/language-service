import { pipe } from "effect/Function"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const flatMapToMap = LSP.createDiagnostic({
  name: "flatMapToMap",
  code: 76,
  description:
    "Suggests using Effect.map instead of Effect.flatMap when the callback only wraps its result with Effect.succeed",
  group: "style",
  severity: "suggestion",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("flatMapToMap.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const flows = yield* typeParser.pipingFlows(true)(sourceFile)
    for (const flow of flows) {
      for (const transformation of flow.transformations) {
        if (
          !transformation.args || transformation.args.length === 0 ||
          !ts.isPropertyAccessExpression(transformation.callee)
        ) continue

        const isFlatMapCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("flatMap")(transformation.callee),
          Nano.orUndefined
        )
        if (!isFlatMapCall) continue

        const callback = transformation.args[0]
        if (!callback) continue
        const parsedCallback = yield* pipe(typeParser.functionExpression(callback), Nano.orUndefined)
        if (
          !parsedCallback || !ts.isCallExpression(parsedCallback.expression) ||
          parsedCallback.expression.arguments.length !== 1
        ) continue

        const isSucceedCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("succeed")(parsedCallback.expression.expression),
          Nano.orUndefined
        )
        if (!isSucceedCall) continue

        const flatMapCallee = transformation.callee
        const succeedCall = parsedCallback.expression
        const succeedValue = succeedCall.arguments[0]!
        report({
          location: flatMapCallee,
          messageText:
            "`Effect.map` expresses this success-value transformation more directly than `Effect.flatMap` followed by `Effect.succeed`.",
          fixes: [{
            fixName: "flatMapToMap_fix",
            description: "Replace with Effect.map",
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

              changeTracker.replaceNode(
                sourceFile,
                flatMapCallee.name,
                ts.factory.createIdentifier("map")
              )
              changeTracker.replaceNode(sourceFile, succeedCall, succeedValue)
            })
          }]
        })
      }
    }
  })
})
