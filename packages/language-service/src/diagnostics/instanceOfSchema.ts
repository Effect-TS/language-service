import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const instanceOfSchema = LSP.createDiagnostic({
  name: "instanceOfSchema",
  code: 45,
  description: "Suggests using Schema.is instead of instanceof for Effect Schema types",
  severity: "off",
  apply: Nano.fn("instanceOfSchema.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is an instanceof binary expression
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
        const leftExpr = node.left
        const rightExpr = node.right

        // Get the type of the right-hand side (the schema)
        const rightType = typeCheckerUtils.getTypeAtLocation(rightExpr)
        if (!rightType) {
          ts.forEachChild(node, appendNodeToVisit)
          continue
        }

        // Check if the right-hand side is an Effect Schema type
        const isSchemaType = yield* pipe(
          typeParser.effectSchemaType(rightType, rightExpr),
          Nano.option
        )

        if (isSchemaType._tag === "Some") {
          report({
            location: node,
            messageText: "Consider using Schema.is instead of instanceof for Effect Schema types.",
            fixes: [{
              fixName: "instanceOfSchema_fix",
              description: "Replace with Schema.is",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                // Create Schema.is(schema)(value) call
                // First: Schema.is(schema)
                const schemaIsCall = ts.factory.createCallExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier("Schema"),
                    "is"
                  ),
                  undefined,
                  [rightExpr]
                )

                // Then: Schema.is(schema)(value)
                const fullCall = ts.factory.createCallExpression(
                  schemaIsCall,
                  undefined,
                  [leftExpr]
                )

                changeTracker.replaceNode(sourceFile, node, fullCall)
              })
            }]
          })
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
