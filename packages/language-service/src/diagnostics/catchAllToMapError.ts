import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const catchAllToMapError = LSP.createDiagnostic({
  name: "catchAllToMapError",
  code: 39,
  description:
    "Suggests using Effect.mapError instead of Effect.catchAll when the callback only wraps the error with Effect.fail",
  group: "style",
  severity: "suggestion",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("catchAllToMapError.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const catchAllName = typeParser.supportedEffect() === "v3" ? "catchAll" : "catch"

    /**
     * Checks if the function expression is an Effect.fail call and returns info about it
     * Returns the Effect.fail call expression node and the argument
     */
    const getEffectFailCallInfo = (
      expression: ts.Expression
    ): Nano.Nano<{ failCall: ts.CallExpression; failArg: ts.Expression } | undefined> => {
      if (ts.isCallExpression(expression)) {
        return pipe(
          typeParser.isNodeReferenceToEffectModuleApi("fail")(expression.expression),
          Nano.orUndefined,
          Nano.map((isFailCall) => {
            if (isFailCall && expression.arguments.length >= 1) {
              return ({ failCall: expression, failArg: expression.arguments[0] })
            }
            return undefined
          })
        )
      }
      return Nano.void_
    }

    // Get all piping flows for the source file (including Effect.fn pipe transformations)
    const flows = yield* typeParser.pipingFlows(true)(sourceFile)

    for (const flow of flows) {
      // Look for Effect.catchAll transformations in the flow
      for (const transformation of flow.transformations) {
        // Skip if no args (constants like Effect.asVoid)
        if (!transformation.args || transformation.args.length === 0) {
          continue
        }

        // Check if the callee is Effect.catchAll
        const isCatchAllCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi(catchAllName)(transformation.callee),
          Nano.orUndefined
        )

        if (!isCatchAllCall) {
          continue
        }

        // Get the callback argument
        const callback = transformation.args[0]
        if (!callback) continue

        const parsedCallback = yield* pipe(typeParser.functionExpression(callback), Nano.orUndefined)
        if (!parsedCallback) continue

        // Check if the function body is a single Effect.fail call
        const failCallInfo = yield* getEffectFailCallInfo(parsedCallback.expression)
        if (!failCallInfo) continue

        const { failArg, failCall } = failCallInfo

        // Create the quick fix
        report({
          location: transformation.callee,
          messageText:
            `\`Effect.mapError\` expresses the same error-type transformation more directly than \`Effect.${catchAllName}\` followed by \`Effect.fail\`.`,
          fixes: [{
            fixName: "catchAllToMapError_fix",
            description: "Replace with Effect.mapError",
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

              // Minimal changes approach:
              // 1. Replace "catchAll" with "mapError" in the property access
              // 2. Replace the Effect.fail(arg) call with just arg

              // Replace catchAll with mapError
              if (ts.isPropertyAccessExpression(transformation.callee)) {
                changeTracker.replaceNode(
                  sourceFile,
                  transformation.callee.name,
                  ts.factory.createIdentifier("mapError")
                )
              }

              // Replace Effect.fail(arg) with just arg
              changeTracker.replaceNode(sourceFile, failCall, failArg)
            })
          }]
        })
      }
    }
  })
})
