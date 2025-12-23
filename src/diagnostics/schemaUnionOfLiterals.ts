import { pipe } from "effect"
import * as Array from "effect/Array"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const schemaUnionOfLiterals = LSP.createDiagnostic({
  name: "schemaUnionOfLiterals",
  code: 33,
  description: "Simplifies Schema.Union of multiple Schema.Literal calls into single Schema.Literal",
  severity: "off",
  apply: Nano.fn("schemaUnionOfLiterals.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a call expression: Schema.Union(...)
      if (ts.isCallExpression(node)) {
        // Check if it's a Schema.Union call using TypeParser
        const isSchemaUnionCall = yield* pipe(
          typeParser.isNodeReferenceToEffectSchemaModuleApi("Union")(node.expression),
          Nano.orElse(() => Nano.void_)
        )

        if (isSchemaUnionCall) {
          // Check if all arguments are plain Schema.Literal calls
          const args = Array.fromIterable(node.arguments)

          // Need at least 2 arguments for union to make sense
          if (args.length >= 2) {
            // Check if all arguments are call expressions
            const allAreCallExpressions = args.every((arg) => ts.isCallExpression(arg))

            if (allAreCallExpressions) {
              // Build checks for each argument to verify they are Schema.Literal calls
              const literalChecks = args.map((arg) => {
                const callArg = arg as ts.CallExpression
                return pipe(
                  typeParser.isNodeReferenceToEffectSchemaModuleApi("Literal")(callArg.expression),
                  Nano.map(() => callArg)
                )
              })

              // Use Nano.all to check all arguments in parallel, then wrap in option
              const allLiteralsResult = yield* pipe(
                Nano.all(...literalChecks),
                Nano.option
              )

              // If all checks succeeded and all have arguments, report diagnostic
              if (allLiteralsResult._tag === "Some") {
                // Collect all literal values from all Schema.Literal calls
                const allLiteralValues: Array<ts.Expression> = []
                for (const literalCall of allLiteralsResult.value) {
                  for (const arg of literalCall.arguments) {
                    allLiteralValues.push(arg)
                  }
                }

                // Get the first Schema.Literal identifier to reuse
                const firstLiteralCall = allLiteralsResult.value[0]
                const schemaLiteralExpression = firstLiteralCall.expression

                report({
                  location: node,
                  messageText:
                    "A Schema.Union of multiple Schema.Literal calls can be simplified to a single Schema.Literal call.",
                  fixes: [{
                    fixName: "schemaUnionOfLiterals_fix",
                    description: "Replace with a single Schema.Literal call",
                    apply: Nano.gen(function*() {
                      const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                      // Create the new Schema.Literal call with all literal values
                      const newNode = ts.factory.createCallExpression(
                        schemaLiteralExpression,
                        undefined,
                        allLiteralValues
                      )

                      changeTracker.replaceNode(sourceFile, node, newNode)
                    })
                  }]
                })
              }
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
