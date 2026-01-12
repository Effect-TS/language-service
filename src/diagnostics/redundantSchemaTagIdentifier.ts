import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const redundantSchemaTagIdentifier = LSP.createDiagnostic({
  name: "redundantSchemaTagIdentifier",
  code: 42,
  description:
    "Suggests removing redundant identifier argument when it equals the tag value in Schema.TaggedClass/TaggedError/TaggedRequest",
  severity: "suggestion",
  apply: Nano.fn("redundantSchemaTagIdentifier.apply")(function*(sourceFile, report) {
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

      // Check if this is a class declaration that extends Schema.TaggedClass/TaggedError/TaggedRequest
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        const result = yield* pipe(
          typeParser.extendsSchemaTaggedClass(node),
          Nano.orElse(() => typeParser.extendsSchemaTaggedError(node)),
          Nano.orElse(() => typeParser.extendsSchemaTaggedRequest(node)),
          Nano.orElse(() => Nano.void_)
        )

        if (result && result.keyStringLiteral && result.tagStringLiteral) {
          const { keyStringLiteral, tagStringLiteral } = result

          // Check if the key (identifier) and tag have the same value
          if (keyStringLiteral.text === tagStringLiteral.text) {
            report({
              location: keyStringLiteral,
              messageText: `Identifier '${keyStringLiteral.text}' is redundant since it equals the _tag value`,
              fixes: [{
                fixName: "redundantSchemaTagIdentifier_removeIdentifier",
                description: `Remove redundant identifier '${keyStringLiteral.text}'`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Delete the string literal text range to remove the redundant identifier
                  changeTracker.deleteRange(sourceFile, {
                    pos: ts.getTokenPosOfNode(keyStringLiteral, sourceFile),
                    end: keyStringLiteral.end
                  })
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
