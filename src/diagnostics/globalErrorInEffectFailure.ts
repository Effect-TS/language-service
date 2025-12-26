import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const globalErrorInEffectFailure = LSP.createDiagnostic({
  name: "globalErrorInEffectFailure",
  code: 35,
  description: "Warns when Effect.fail is called with the global Error type",
  severity: "warning",
  apply: Nano.fn("globalErrorInEffectFailure.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check for call expressions
      if (ts.isCallExpression(node)) {
        // Check if this is Effect.fail call using TypeParser
        yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("fail")(node.expression),
          Nano.flatMap(() => {
            if (node.arguments.length > 0) {
              const failArgument = node.arguments[0]

              // Get the type of the argument passed to Effect.fail
              const argumentType = typeChecker.getTypeAtLocation(failArgument)

              // Check if the argument type is exactly the global Error type
              if (typeCheckerUtils.isGlobalErrorType(argumentType)) {
                return Nano.sync(() =>
                  report({
                    location: node,
                    messageText:
                      `Effect.fail is called with the global Error type. It's not recommended to use the global Error type in Effect failures as they can get merged together. Instead, use tagged errors (Data.TaggedError) or custom errors with a discriminator property to get properly type-checked errors.`,
                    fixes: []
                  })
                )
              }
            }
            return Nano.void_
          }),
          Nano.ignore
        )
      }
    }
  })
})
