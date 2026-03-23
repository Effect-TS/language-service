import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const globalDate = LSP.createDiagnostic({
  name: "globalDate",
  code: 55,
  description: "Warns when using Date.now() or new Date() inside Effect generators instead of Clock/DateTime",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalDate.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const dateSymbol = typeChecker.resolveName("Date", undefined, ts.SymbolFlags.Value, false)
    if (!dateSymbol) return

    const collected: Array<{ node: ts.Node; identifier: ts.Identifier; messageText: string }> = []

    const collectNodes = (node: ts.Node): void => {
      // Date.now()
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ts.idText(node.expression.expression) === "Date" &&
        ts.idText(node.expression.name) === "now"
      ) {
        collected.push({
          node,
          identifier: node.expression.expression,
          messageText: "Prefer using Clock or DateTime from Effect instead of Date.now() inside Effect generators."
        })
      } // new Date() / new Date(...)
      else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ts.idText(node.expression) === "Date"
      ) {
        collected.push({
          node,
          identifier: node.expression,
          messageText: "Prefer using DateTime from Effect instead of new Date() inside Effect generators."
        })
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
      if (resolvedSymbol !== dateSymbol) continue

      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || effectGen.body.statements.length === 0) continue
      if (scopeNode && scopeNode !== effectGen.generatorFunction) continue

      report({ location: node, messageText, fixes: [] })
    }
  })
})
