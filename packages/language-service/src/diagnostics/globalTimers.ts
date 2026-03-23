import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const timerAlternatives: Record<string, string> = {
  "setTimeout": "Prefer using Effect.sleep or Schedule from Effect instead of setTimeout inside Effect generators.",
  "setInterval": "Prefer using Schedule or Effect.repeat from Effect instead of setInterval inside Effect generators."
}

export const globalTimers = LSP.createDiagnostic({
  name: "globalTimers",
  code: 58,
  description: "Warns when using setTimeout/setInterval inside Effect generators instead of Effect.sleep/Schedule",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalTimers.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const globalSymbols = new Map<string, ts.Symbol>()
    for (const name of Object.keys(timerAlternatives)) {
      const symbol = typeChecker.resolveName(name, undefined, ts.SymbolFlags.Value, false)
      if (symbol) globalSymbols.set(name, symbol)
    }
    if (globalSymbols.size === 0) return

    const collected: Array<{ node: ts.Node; identifier: ts.Identifier; name: string }> = []

    const collectNodes = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const name = ts.idText(node.expression)
        if (timerAlternatives[name]) {
          collected.push({ node, identifier: node.expression, name })
        }
      }
      ts.forEachChild(node, collectNodes)
    }
    ts.forEachChild(sourceFile, collectNodes)

    if (collected.length === 0) return

    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    for (const { identifier, name, node } of collected) {
      const expectedSymbol = globalSymbols.get(name)
      if (expectedSymbol) {
        const localSymbol = typeChecker.getSymbolAtLocation(identifier)
        const resolvedSymbol = localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias)
          ? typeChecker.getAliasedSymbol(localSymbol)
          : localSymbol
        if (resolvedSymbol !== expectedSymbol) continue
      }

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({ location: node, messageText: timerAlternatives[name], fixes: [] })
    }
  })
})
