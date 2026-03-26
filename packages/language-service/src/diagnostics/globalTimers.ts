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
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const globalSymbols = new Map<string, ts.Symbol>()
    for (const name of Object.keys(timerAlternatives)) {
      const symbol = typeChecker.resolveName(name, undefined, ts.SymbolFlags.Value, false)
      if (symbol) globalSymbols.set(name, symbol)
    }
    if (globalSymbols.size === 0) return

    const resolveToGlobalSymbol = (node: ts.Node): ts.Symbol | undefined => {
      let symbol = typeChecker.getSymbolAtLocation(node)
      if (!symbol) return undefined
      if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = typeChecker.getAliasedSymbol(symbol)
      }
      let depth = 0
      while (depth < 5 && symbol.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration)) {
        const initializer = symbol.valueDeclaration.initializer
        if (!initializer) break
        let nextSymbol = typeChecker.getSymbolAtLocation(initializer)
        if (!nextSymbol) break
        if (nextSymbol.flags & ts.SymbolFlags.Alias) {
          nextSymbol = typeChecker.getAliasedSymbol(nextSymbol)
        }
        if (nextSymbol === symbol) break
        symbol = nextSymbol
        depth++
      }
      return symbol
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isCallExpression(node)) continue

      const resolvedSymbol = resolveToGlobalSymbol(node.expression)
      if (!resolvedSymbol) continue

      let messageText: string | undefined
      for (const [name, symbol] of globalSymbols) {
        if (resolvedSymbol === symbol) {
          messageText = timerAlternatives[name]
          break
        }
      }
      if (!messageText) continue

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({ location: node, messageText, fixes: [] })
    }
  })
})
