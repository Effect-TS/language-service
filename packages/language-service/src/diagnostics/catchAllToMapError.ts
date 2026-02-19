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
  severity: "suggestion",
  apply: Nano.fn("catchAllToMapError.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const catchAllName = typeParser.supportedEffect() === "v3" ? "catchAll" : "catch"

    /**
     * Gets the body of a function expression or arrow function
     */
    const getFunctionBody = (node: ts.Node): ts.Expression | ts.Block | undefined => {
      if (ts.isArrowFunction(node)) {
        return node.body
      }
      if (ts.isFunctionExpression(node)) {
        return node.body
      }
      return undefined
    }

    /**
     * Checks if the function body is a single Effect.fail call and returns info about it
     * Returns the Effect.fail call expression node and the argument
     */
    const getEffectFailCallInfo = (
      body: ts.Expression | ts.Block
    ): Nano.Nano<{ failCall: ts.CallExpression; failArg: ts.Expression } | undefined> => {
      // If body is an expression (arrow function without braces)
      if (ts.isCallExpression(body)) {
        return pipe(
          typeParser.isNodeReferenceToEffectModuleApi("fail")(body.expression),
          Nano.orUndefined,
          Nano.map((isFailCall) => {
            if (isFailCall && body.arguments.length >= 1) {
              return ({ failCall: body, failArg: body.arguments[0] })
            }
            return undefined
          })
        )
      }

      // If body is a block, check for single return statement with Effect.fail
      if (ts.isBlock(body)) {
        const statements = body.statements
        if (statements.length === 1) {
          const stmt = statements[0]
          if (ts.isReturnStatement(stmt) && stmt.expression && ts.isCallExpression(stmt.expression)) {
            const callExpr = stmt.expression
            return pipe(
              typeParser.isNodeReferenceToEffectModuleApi("fail")(callExpr.expression),
              Nano.orUndefined,
              Nano.map((isFailCall) => {
                if (isFailCall && callExpr.arguments.length >= 1) {
                  return ({ failCall: callExpr, failArg: callExpr.arguments[0] })
                }
                return undefined
              })
            )
          }
        }
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

        // Get the body of the callback function
        const functionBody = getFunctionBody(callback)
        if (!functionBody) continue

        // Check if the function body is a single Effect.fail call or a block with a single return Effect.fail
        const failCallInfo = yield* getEffectFailCallInfo(functionBody)
        if (!failCallInfo) continue

        const { failArg, failCall } = failCallInfo

        // Create the quick fix
        report({
          location: transformation.callee,
          messageText:
            `You can use Effect.mapError instead of Effect.${catchAllName} + Effect.fail to transform the error type.`,
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
