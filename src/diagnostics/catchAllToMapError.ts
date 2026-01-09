import { pipe } from "effect/Function"
import * as Option from "effect/Option"
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
    ): Nano.Nano<Option.Option<{ failCall: ts.CallExpression; failArg: ts.Expression }>> => {
      return Nano.gen(function*() {
        // If body is an expression (arrow function without braces)
        if (ts.isCallExpression(body)) {
          const isFailCall = yield* pipe(
            typeParser.isNodeReferenceToEffectModuleApi("fail")(body.expression),
            Nano.option
          )
          if (Option.isSome(isFailCall) && body.arguments.length >= 1) {
            return Option.some({ failCall: body, failArg: body.arguments[0] })
          }
        }

        // If body is a block, check for single return statement with Effect.fail
        if (ts.isBlock(body)) {
          const statements = body.statements
          if (statements.length === 1) {
            const stmt = statements[0]
            if (ts.isReturnStatement(stmt) && stmt.expression && ts.isCallExpression(stmt.expression)) {
              const isFailCall = yield* pipe(
                typeParser.isNodeReferenceToEffectModuleApi("fail")(stmt.expression.expression),
                Nano.option
              )
              if (Option.isSome(isFailCall) && stmt.expression.arguments.length >= 1) {
                return Option.some({ failCall: stmt.expression, failArg: stmt.expression.arguments[0] })
              }
            }
          }
        }

        return Option.none()
      })
    }

    // Get all piping flows for the source file
    const flows = yield* typeParser.pipingFlows(sourceFile)

    for (const flow of flows) {
      // Look for Effect.catchAll transformations in the flow
      for (const transformation of flow.transformations) {
        // Skip if no args (constants like Effect.asVoid)
        if (!transformation.args || transformation.args.length === 0) {
          continue
        }

        // Check if the callee is Effect.catchAll
        const isCatchAllCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("catchAll")(transformation.callee),
          Nano.option
        )

        if (Option.isNone(isCatchAllCall)) {
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
        if (Option.isNone(failCallInfo)) continue

        const { failArg, failCall } = failCallInfo.value

        // Create the quick fix
        report({
          location: transformation.callee,
          messageText:
            `You can use Effect.mapError instead of Effect.catchAll + Effect.fail to transform the error type.`,
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
