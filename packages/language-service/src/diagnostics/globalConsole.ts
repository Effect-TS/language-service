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

    const consoleSymbol = typeChecker.resolveName("console", undefined, ts.SymbolFlags.Value, false)
    if (!consoleSymbol) return

    const collected: Array<{ node: ts.Node; identifier: ts.Identifier; messageText: string }> = []

    const collectNodes = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ts.idText(node.expression.expression) === "console"
      ) {
        const method = ts.idText(node.expression.name)
        const alternative = consoleMethodAlternatives[method]
        if (alternative) {
          collected.push({
            node,
            identifier: node.expression.expression,
            messageText: `Prefer using ${alternative} instead of console.${method} inside Effect generators.`
          })
        }
      }
      ts.forEachChild(node, collectNodes)
    }
    ts.forEachChild(sourceFile, collectNodes)

    if (collected.length === 0) return

    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    for (const { identifier, messageText, node } of collected) {
      const localSymbol = typeChecker.getSymbolAtLocation(identifier)
      const resolvedSymbol = localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias)
        ? typeChecker.getAliasedSymbol(localSymbol)
        : localSymbol
      if (resolvedSymbol !== consoleSymbol) continue

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({ location: node, messageText, fixes: [] })
    }
  })
})
