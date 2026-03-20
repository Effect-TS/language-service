import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const globalFetch = LSP.createDiagnostic({
  name: "globalFetch",
  code: 53,
  description: "Warns when using the global fetch function instead of the Effect HTTP client",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("globalFetch.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const fetchSymbol = typeChecker.resolveName("fetch", undefined, ts.SymbolFlags.Value, false)
    if (!fetchSymbol) return

    const effectVersion = typeParser.supportedEffect()
    const packageName = effectVersion === "v3" ? "@effect/platform" : "effect/unstable/http"
    const messageText = `Prefer using HttpClient from ${packageName} instead of the global 'fetch' function.`

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      if (ts.isCallExpression(node)) {
        const symbol = typeChecker.getSymbolAtLocation(node.expression)
        const resolvedSymbol = symbol && (symbol.flags & ts.SymbolFlags.Alias)
          ? typeChecker.getAliasedSymbol(symbol)
          : symbol

        if (resolvedSymbol === fetchSymbol) {
          report({
            location: node.expression,
            messageText,
            fixes: []
          })
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
