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
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const mathSymbol = typeChecker.resolveName("Math", undefined, ts.SymbolFlags.Value, false)
    if (!mathSymbol) return

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

      if (
        !ts.isCallExpression(node) ||
        !ts.isPropertyAccessExpression(node.expression) ||
        ts.idText(node.expression.name) !== "random"
      ) continue

      if (resolveToGlobalSymbol(node.expression.expression) !== mathSymbol) continue

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
