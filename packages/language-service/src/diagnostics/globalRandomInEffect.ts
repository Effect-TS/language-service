import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const makeGlobalRandomApply = (checkInEffect: boolean) =>
  Nano.fn(`globalRandom${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const mathSymbol = typeChecker.resolveName("Math", undefined, ts.SymbolFlags.Value, false)
    if (!mathSymbol) return

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

      const symbol = typeChecker.getSymbolAtLocation(node.expression.expression)
      if (!symbol) continue
      if (typeCheckerUtils.resolveToGlobalSymbol(symbol) !== mathSymbol) continue

      const inEffect =
        ((yield* typeParser.getEffectContextFlags(node)) & TypeParser.EffectContextFlags.CanYieldEffect) !== 0
      if (inEffect !== checkInEffect) continue

      report({
        location: node,
        messageText: checkInEffect
          ? "This Effect code uses `Math.random()`, randomness is represented through the Effect `Random` service."
          : "This code uses `Math.random()`, randomness is represented through the Effect `Random` service.",
        fixes: []
      })
    }
  })

export const globalRandomInEffect = LSP.createDiagnostic({
  name: "globalRandomInEffect",
  code: 57,
  description: "Warns when using Math.random() inside Effect generators instead of the Random service",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalRandomApply(true)
})
