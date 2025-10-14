import { pipe } from "effect"
import type ts from "typescript"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const deterministicKeys = LSP.createDiagnostic({
  name: "deterministicKeys",
  code: 25,
  severity: "off",
  apply: Nano.fn("deterministicKeys.apply")(function*(sourceFile, report) {
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

      // Check if this is a class declaration that extends Effect.Service, Context.Tag, or Effect.Tag
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        // Try to parse as one of the supported tag/service types
        // @effect-diagnostics-next-line unnecessaryPipeChain:off
        const result = yield* pipe(
          pipe(
            typeParser.extendsEffectService(node),
            Nano.orElse(() => typeParser.extendsContextTag(node)),
            Nano.orElse(() => typeParser.extendsEffectTag(node)),
            Nano.map(({ className, keyStringLiteral }) => ({ keyStringLiteral, className, target: "service" as const }))
          ),
          Nano.orElse(() =>
            pipe(
              typeParser.extendsDataTaggedError(node),
              Nano.orElse(() => typeParser.extendsSchemaTaggedError(node)),
              Nano.map(({ className, keyStringLiteral }) => ({ keyStringLiteral, className, target: "error" as const }))
            )
          ),
          Nano.orElse(() => Nano.void_)
        )

        if (result && result.keyStringLiteral) {
          const { className, keyStringLiteral } = result

          // Get the class name text
          const classNameText = ts.idText(className)

          // build the expected identifier
          const expectedKey = yield* KeyBuilder.createString(sourceFile, classNameText, result.target)
          if (!expectedKey) continue

          // Get the actual identifier from the keyStringLiteral
          const actualIdentifier = keyStringLiteral.text

          // Report diagnostic if they don't match
          if (actualIdentifier !== expectedKey) {
            report({
              location: keyStringLiteral,
              messageText: `Key should be '${expectedKey}'`,
              fixes: [{
                fixName: "deterministicKeys_fix",
                description: `Replace '${actualIdentifier}' with '${expectedKey}'`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Create a new string literal with the correct identifier
                  const newStringLiteral = ts.factory.createStringLiteral(expectedKey)

                  // Replace the incorrect string literal with the correct one
                  changeTracker.replaceNode(sourceFile, keyStringLiteral, newStringLiteral)
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
