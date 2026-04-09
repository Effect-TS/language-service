import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const makeCryptoRandomUUIDApply = (checkInEffect: boolean) =>
  Nano.fn(`cryptoRandomUUID${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const cryptoSymbol = typeChecker.resolveName("crypto", undefined, ts.SymbolFlags.Value, false)
    if (!cryptoSymbol) return

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
        ts.idText(node.expression.name) !== "randomUUID"
      ) continue

      const symbol = typeChecker.getSymbolAtLocation(node.expression.expression)
      if (!symbol) continue
      if (typeCheckerUtils.resolveToGlobalSymbol(symbol) !== cryptoSymbol) continue

      const inEffect = ((yield* typeParser.getEffectContextFlags(node)) & TypeParser.EffectContextFlags.InEffect) !== 0
      if (inEffect !== checkInEffect) continue

      report({
        location: node,
        messageText: checkInEffect
          ? "This Effect code uses `crypto.randomUUID()`, prefer the Effect `Random` module instead because it uses Effect-injected randomness rather than the `crypto` module behind the scenes."
          : "This code uses `crypto.randomUUID()`, prefer the Effect `Random` module instead because it uses Effect-injected randomness rather than the `crypto` module behind the scenes.",
        fixes: []
      })
    }
  })

export const cryptoRandomUUIDInEffect = LSP.createDiagnostic({
  name: "cryptoRandomUUIDInEffect",
  code: 67,
  description:
    "Warns when using crypto.randomUUID() inside Effect generators instead of the Effect Random module, which uses Effect-injected randomness rather than the crypto module behind the scenes",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v4"],
  apply: makeCryptoRandomUUIDApply(true)
})
