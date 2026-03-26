import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const consoleMethodAlternatives: Record<string, string> = {
  "log": "Effect.log or Logger",
  "warn": "Effect.logWarning or Logger",
  "error": "Effect.logError or Logger",
  "info": "Effect.logInfo or Logger",
  "debug": "Effect.logDebug or Logger",
  "trace": "Effect.logTrace or Logger"
}

export const globalConsole = LSP.createDiagnostic({
  name: "globalConsole",
  code: 56,
  description: "Warns when using console methods inside Effect generators instead of Effect.log/Logger",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalConsole.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const consoleSymbol = typeChecker.resolveName("console", undefined, ts.SymbolFlags.Value, false)
    if (!consoleSymbol) return

    const resolveToGlobalSymbol = (node: ts.Node): ts.Symbol | undefined => {
      let symbol = typeChecker.getSymbolAtLocation(node)
      if (!symbol) return undefined
      // Follow import aliases
      if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = typeChecker.getAliasedSymbol(symbol)
      }
      // Follow variable initializer chains: const x = console; x.log(...)
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

      if (
        !ts.isCallExpression(node) ||
        !ts.isPropertyAccessExpression(node.expression)
      ) continue

      const method = ts.idText(node.expression.name)
      const alternative = consoleMethodAlternatives[method]
      if (!alternative) continue

      if (resolveToGlobalSymbol(node.expression.expression) !== consoleSymbol) continue

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({
        location: node,
        messageText: `Prefer using ${alternative} instead of console.${method} inside Effect generators.`,
        fixes: []
      })
    }
  })
})
