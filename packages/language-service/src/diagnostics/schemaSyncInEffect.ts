import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const syncToEffectMethod: Record<string, string> = {
  decodeSync: "decode",
  decodeUnknownSync: "decodeUnknown",
  encodeSync: "encode",
  encodeUnknownSync: "encodeUnknown"
}

export const schemaSyncInEffect = LSP.createDiagnostic({
  name: "schemaSyncInEffect",
  code: 43,
  description: "Suggests using Effect-based Schema methods instead of sync methods inside Effect generators",
  severity: "suggestion",
  apply: Nano.fn("schemaSyncInEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const parseSchemaSyncMethod = (node: ts.Node, methodName: string) =>
      pipe(
        typeParser.isNodeReferenceToEffectParseResultModuleApi(methodName)(node),
        Nano.map(() => ({ node, methodName }))
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

      // Check if this is a call expression
      if (!ts.isCallExpression(node)) continue

      // Verify it's a Schema sync method call using TypeParser
      const isSchemaSyncCall = yield* pipe(
        Nano.firstSuccessOf(
          Object.keys(syncToEffectMethod).map((methodName) => parseSchemaSyncMethod(node.expression, methodName))
        ),
        Nano.option
      )

      if (Option.isNone(isSchemaSyncCall)) continue

      // Find enclosing scope and Effect generator using TypeParser helper
      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)

      // Skip if not inside an Effect generator or if the sync call is inside a nested function scope
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      const nodeText = sourceFile.text.substring(
        ts.getTokenPosOfNode(node.expression, sourceFile),
        node.expression.end
      )
      const effectMethodName = syncToEffectMethod[isSchemaSyncCall.value.methodName]

      report({
        location: node.expression,
        messageText:
          `Using ${nodeText} inside an Effect generator is not recommended. Use Schema.${effectMethodName} instead to get properly typed ParseError in the error channel.`,
        fixes: []
      })
    }
  })
})
