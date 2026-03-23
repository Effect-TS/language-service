import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const globalRandom = LSP.createDiagnostic({
  name: "globalRandom",
  code: 57,
  description: "Warns when using Math.random() inside Effect generators instead of the Random service",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalRandom.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const mathSymbol = typeChecker.resolveName("Math", undefined, ts.SymbolFlags.Value, false)
    if (!mathSymbol) return

    const collected: Array<{ node: ts.Node; identifier: ts.Identifier }> = []

    const collectNodes = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ts.idText(node.expression.expression) === "Math" &&
        ts.idText(node.expression.name) === "random"
      ) {
        collected.push({ node, identifier: node.expression.expression })
      }
      ts.forEachChild(node, collectNodes)
    }
    ts.forEachChild(sourceFile, collectNodes)

    if (collected.length === 0) return

    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    for (const { identifier, node } of collected) {
      const localSymbol = typeChecker.getSymbolAtLocation(identifier)
      const resolvedSymbol = localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias)
        ? typeChecker.getAliasedSymbol(localSymbol)
        : localSymbol
      if (resolvedSymbol !== mathSymbol) continue

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({
        location: node,
        messageText: "Prefer using the Random service from Effect instead of Math.random() inside Effect generators.",
        fixes: []
      })
    }
  })
})
