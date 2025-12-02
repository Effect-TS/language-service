import { pipe } from "effect"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const schemaUnsafeTypes = LSP.createDiagnostic({
  name: "schemaUnsafeTypes",
  code: 35,
  severity: "off",
  apply: Nano.fn("schemaUnsafeTypes.apply")(function*(sourceFile, report) {
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

      if (ts.isIdentifier(node)) {
        // Handle Schema.Number
        const isSchemaNumber = yield* pipe(
          typeParser.isNodeReferenceToEffectSchemaModuleApi("Number")(node),
          Nano.option,
          Nano.map(Option.isSome)
        )

        if (isSchemaNumber) {
          report({
            location: node,
            messageText: "Schema.Number is unsafe. Use Schema.JsonNumber instead.",
            fixes: [{
              fixName: "schemaUnsafeTypes_replaceWithJsonNumber",
              description: "Replace with Schema.JsonNumber",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                changeTracker.replaceNode(sourceFile, node, ts.factory.createIdentifier("JsonNumber"))
              })
            }]
          })
        } else {
          // Handle Schema.Date
          const isSchemaDate = yield* pipe(
            typeParser.isNodeReferenceToEffectSchemaModuleApi("Date")(node),
            Nano.option,
            Nano.map(Option.isSome)
          )

          if (isSchemaDate) {
            report({
              location: node,
              messageText: "Schema.Date is unsafe. Use Schema.ValidDate instead.",
              fixes: [{
                fixName: "schemaUnsafeTypes_replaceWithValidDate",
                description: "Replace with Schema.ValidDate",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                  changeTracker.replaceNode(sourceFile, node, ts.factory.createIdentifier("ValidDate"))
                })
              }]
            })
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
