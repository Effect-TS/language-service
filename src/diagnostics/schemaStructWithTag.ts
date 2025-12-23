import { pipe } from "effect"
import * as Array from "effect/Array"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const schemaStructWithTag = LSP.createDiagnostic({
  name: "schemaStructWithTag",
  code: 34,
  description: "Suggests using Schema.TaggedStruct instead of Schema.Struct with _tag field",
  severity: "suggestion",
  apply: Nano.fn("schemaStructWithTag.apply")(function*(sourceFile, report) {
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

      // Check if this is a call expression: Schema.Struct(...)
      if (ts.isCallExpression(node)) {
        // Check if it's a Schema.Struct call using TypeParser
        const isSchemaStructCall = yield* pipe(
          typeParser.isNodeReferenceToEffectSchemaModuleApi("Struct")(node.expression),
          Nano.orElse(() => Nano.void_)
        )

        if (isSchemaStructCall && node.arguments.length === 1) {
          const arg = node.arguments[0]

          // Check if the argument is an object literal
          if (ts.isObjectLiteralExpression(arg)) {
            // Look for a _tag property
            const tagProperty = arg.properties.find((prop) =>
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              ts.idText(prop.name) === "_tag"
            ) as ts.PropertyAssignment | undefined

            if (tagProperty && ts.isCallExpression(tagProperty.initializer)) {
              // Check if the _tag value is a Schema.Literal call
              const isSchemaLiteralCall = yield* pipe(
                typeParser.isNodeReferenceToEffectSchemaModuleApi("Literal")(
                  tagProperty.initializer.expression
                ),
                Nano.option
              )

              if (isSchemaLiteralCall._tag === "Some") {
                // Extract the literal value from Schema.Literal call
                const literalCall = tagProperty.initializer
                const literalArgs = Array.fromIterable(literalCall.arguments)

                // Schema.Literal should have exactly one argument that is a string literal
                if (
                  literalArgs.length === 1 &&
                  ts.isStringLiteral(literalArgs[0])
                ) {
                  const tagValue = literalArgs[0].text

                  // Create the other properties (excluding _tag)
                  const otherProperties = arg.properties.filter((prop) => prop !== tagProperty)

                  report({
                    location: node,
                    messageText:
                      "Schema.Struct with a _tag field can be simplified to Schema.TaggedStruct to make the tag optional in the constructor.",
                    fixes: [{
                      fixName: "schemaStructWithTag_fix",
                      description: "Replace with Schema.TaggedStruct",
                      apply: Nano.gen(function*() {
                        const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                        // Create new object literal without the _tag property
                        const newObjectLiteral = ts.factory.createObjectLiteralExpression(
                          otherProperties,
                          true
                        )

                        // Create the new Schema.TaggedStruct call
                        // Schema.TaggedStruct("TagValue", { ...otherProps })
                        const newNode = ts.factory.createCallExpression(
                          ts.factory.createPropertyAccessExpression(
                            // Reuse the Schema identifier from the original expression
                            ts.isPropertyAccessExpression(node.expression)
                              ? node.expression.expression
                              : ts.factory.createIdentifier("Schema"),
                            "TaggedStruct"
                          ),
                          undefined,
                          [
                            ts.factory.createStringLiteral(tagValue),
                            newObjectLiteral
                          ]
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
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
