import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
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

export const makeGlobalConsoleApply = (checkInEffect: boolean) =>
  Nano.fn(`globalConsole${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const consoleSymbol = typeChecker.resolveName("console", undefined, ts.SymbolFlags.Value, false)
    if (!consoleSymbol) return

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

      const symbol = typeChecker.getSymbolAtLocation(node.expression.expression)
      if (!symbol) continue
      if (typeCheckerUtils.resolveToGlobalSymbol(symbol) !== consoleSymbol) continue

      const inEffect =
        ((yield* typeParser.getEffectContextFlags(node)) & TypeParser.EffectContextFlags.CanYieldEffect) !== 0
      if (inEffect !== checkInEffect) continue

      report({
        location: node,
        messageText: checkInEffect
          ? `This Effect code uses \`console.${method}\`, logging in Effect code is represented through \`${alternative}\`.`
          : `This code uses \`console.${method}\`, the corresponding Effect logging API is \`${alternative}\`.`,
        fixes: []
      })
    }
  })

export const globalConsoleInEffect = LSP.createDiagnostic({
  name: "globalConsoleInEffect",
  code: 56,
  description: "Warns when using console methods inside Effect generators instead of Effect.log/Logger",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalConsoleApply(true)
})
