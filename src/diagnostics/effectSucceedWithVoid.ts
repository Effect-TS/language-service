import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const effectSucceedWithVoid = LSP.createDiagnostic({
  name: "effectSucceedWithVoid",
  code: 47,
  description: "Suggests using Effect.void instead of Effect.succeed(undefined) or Effect.succeed(void 0)",
  severity: "suggestion",
  apply: Nano.fn("effectSucceedWithVoid.apply")(function*(sourceFile, report) {
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
        // Check if the call expression references Effect.succeed
        const isSucceedCall = yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("succeed")(node.expression),
          Nano.option
        )

        if (Option.isSome(isSucceedCall)) {
          const argument = node.arguments[0]
          if (!argument) continue

          // Check if the argument is undefined or void 0
          if (!tsUtils.isVoidExpression(argument)) continue

          // Create the diagnostic with quick fix
          report({
            location: node,
            messageText: "Effect.void can be used instead of Effect.succeed(undefined) or Effect.succeed(void 0)",
            fixes: [{
              fixName: "effectSucceedWithVoid_fix",
              description: "Replace with Effect.void",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                // Find the Effect module identifier for the replacement
                const effectModuleIdentifier =
                  tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Effect") ||
                  "Effect"

                // Replace Effect.succeed(undefined) with Effect.void
                const newNode = ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier(effectModuleIdentifier),
                  ts.factory.createIdentifier("void")
                )
                changeTracker.replaceNode(sourceFile, node, newNode)
              })
            }]
          })
        }
      }
    }
  })
})
