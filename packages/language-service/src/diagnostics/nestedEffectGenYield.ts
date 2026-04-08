import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const nestedEffectGenYield = LSP.createDiagnostic({
  name: "nestedEffectGenYield",
  code: 71,
  description: "Warns when yielding a nested bare Effect.gen inside an existing Effect generator context",
  group: "style",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("nestedEffectGenYield.apply")(function*(sourceFile, report) {
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
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isYieldExpression(node) || !node.asteriskToken || !node.expression) continue

      const { inEffect } = yield* typeParser.findEnclosingScopes(node)
      if (!inEffect) continue

      const bareNestedEffectGen = yield* Nano.orUndefined(typeParser.effectGen(node.expression))
      if (!bareNestedEffectGen) continue

      report({
        location: node.expression,
        messageText:
          "This `yield*` is applied to a nested `Effect.gen(...)` that can be inlined in the parent Effect generator context.",
        fixes: []
      })
    }
  })
})
