import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryFailYieldableError = LSP.createDiagnostic({
  name: "unnecessaryFailYieldableError",
  code: 29,
  description: "Suggests yielding yieldable errors directly instead of wrapping with Effect.fail",
  severity: "suggestion",
  apply: Nano.fn("unnecessaryFailYieldableError.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    // Get yieldable error types for this source file
    const yieldableErrorTypes = yield* pipe(
      typeParser.effectCauseYieldableErrorTypes(sourceFile),
      Nano.orElse(() => Nano.succeed([]))
    )

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check for yield* expressions with asterisk token
      if (
        ts.isYieldExpression(node) &&
        node.asteriskToken &&
        node.expression &&
        ts.isCallExpression(node.expression)
      ) {
        const callExpression = node.expression

        // Check if this is Effect.fail call using TypeParser
        yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("fail")(callExpression.expression),
          Nano.map(() => {
            if (callExpression.arguments.length > 0) {
              const failArgument = callExpression.arguments[0]

              // Get the type of the argument passed to Effect.fail
              const argumentType = typeChecker.getTypeAtLocation(failArgument)

              // Check if the argument type is assignable to any yieldable error type
              const isYieldableError = yieldableErrorTypes.some((yieldableType: ts.Type) =>
                typeChecker.isTypeAssignableTo(argumentType, yieldableType)
              )

              if (isYieldableError) {
                report({
                  location: node,
                  messageText:
                    `This Effect.fail call uses a yieldable error type as argument. You can yield* the error directly instead.`,
                  fixes: [{
                    fixName: "unnecessaryFailYieldableError_fix",
                    description: "Replace yield* Effect.fail with yield*",
                    apply: Nano.gen(function*() {
                      const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                      // Replace Effect.fail(error) with error
                      changeTracker.replaceNode(
                        sourceFile,
                        callExpression,
                        failArgument
                      )
                    })
                  }]
                })
              }
            }
          }),
          Nano.ignore
        )
      }
    }
  })
})
