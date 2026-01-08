import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const effectMapVoid = LSP.createDiagnostic({
  name: "effectMapVoid",
  code: 40,
  description:
    "Suggests using Effect.asVoid instead of Effect.map(() => void 0), Effect.map(() => undefined), or Effect.map(() => {})",
  severity: "suggestion",
  apply: Nano.fn("effectMapVoid.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a call expression
      if (ts.isCallExpression(node)) {
        // Check if the call expression references Effect.map
        const isMapCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("map")(node.expression),
          Nano.option
        )

        if (Option.isSome(isMapCall)) {
          const callback = node.arguments[0]
          if (!callback) continue

          // Try to match emptyFunction first, then lazyExpression with void expression
          const match = yield* pipe(
            typeParser.emptyFunction(callback),
            Nano.orElse(() =>
              pipe(
                typeParser.lazyExpression(callback),
                Nano.flatMap((lazy) =>
                  tsUtils.isVoidExpression(lazy.expression)
                    ? Nano.succeed(lazy)
                    : TypeParser.typeParserIssue("Expression is not void")
                )
              )
            ),
            Nano.option
          )

          if (Option.isNone(match)) continue

          // Create the diagnostic with quick fix
          report({
            location: node.expression,
            messageText: "Effect.asVoid can be used instead to discard the success value",
            fixes: [{
              fixName: "effectMapVoid_fix",
              description: "Replace with Effect.asVoid",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                // Replace .map(...) with .asVoid (no parentheses)
                if (ts.isPropertyAccessExpression(node.expression)) {
                  const newNode = ts.factory.createPropertyAccessExpression(
                    node.expression.expression,
                    ts.factory.createIdentifier("asVoid")
                  )
                  changeTracker.replaceNode(sourceFile, node, newNode)
                }
              })
            }]
          })
        }
      }
    }
  })
})
