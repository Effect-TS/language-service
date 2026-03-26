import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const timerAlternatives: Record<string, { inEffect: string; outsideEffect: string }> = {
  "setTimeout": {
    inEffect: "Prefer using Effect.sleep or Schedule from Effect instead of setTimeout inside Effect generators.",
    outsideEffect: "Prefer using Effect.sleep or Schedule from Effect instead of setTimeout."
  },
  "setInterval": {
    inEffect: "Prefer using Schedule or Effect.repeat from Effect instead of setInterval inside Effect generators.",
    outsideEffect: "Prefer using Schedule or Effect.repeat from Effect instead of setInterval."
  }
}

export const makeGlobalTimersApply = (checkInEffect: boolean) =>
  Nano.fn(`globalTimers${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const globalSymbols = new Map<string, ts.Symbol>()
    for (const name of Object.keys(timerAlternatives)) {
      const symbol = typeChecker.resolveName(name, undefined, ts.SymbolFlags.Value, false)
      if (symbol) globalSymbols.set(name, symbol)
    }
    if (globalSymbols.size === 0) return

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

      const symbol = typeChecker.getSymbolAtLocation(node.expression)
      if (!symbol) continue
      const resolvedSymbol = typeCheckerUtils.resolveToGlobalSymbol(symbol)

      let messageText: string | undefined
      for (const [name, symbol] of globalSymbols) {
        if (resolvedSymbol === symbol) {
          messageText = checkInEffect ? timerAlternatives[name].inEffect : timerAlternatives[name].outsideEffect
          break
        }
      }
      if (!messageText) continue

      const { inEffect } = yield* typeParser.findEnclosingScopes(node)
      if (inEffect !== checkInEffect) continue

      report({ location: node, messageText, fixes: [] })
    }
  })

export const globalTimersInEffect = LSP.createDiagnostic({
  name: "globalTimersInEffect",
  code: 58,
  description: "Warns when using setTimeout/setInterval inside Effect generators instead of Effect.sleep/Schedule",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalTimersApply(true)
})
