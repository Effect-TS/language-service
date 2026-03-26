import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const makeGlobalDateApply = (checkInEffect: boolean) =>
  Nano.fn(`globalDate${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const dateSymbol = typeChecker.resolveName("Date", undefined, ts.SymbolFlags.Value, false)
    if (!dateSymbol) return

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      let messageText: string | undefined
      let objectNode: ts.Node | undefined

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.idText(node.expression.name) === "now"
      ) {
        objectNode = node.expression.expression
        messageText = checkInEffect
          ? "Prefer using Clock or DateTime from Effect instead of Date.now() inside Effect generators."
          : "Prefer using Clock or DateTime from Effect instead of Date.now()."
      } else if (ts.isNewExpression(node)) {
        objectNode = node.expression
        messageText = checkInEffect
          ? "Prefer using DateTime from Effect instead of new Date() inside Effect generators."
          : "Prefer using DateTime from Effect instead of new Date()."
      }

      if (!messageText || !objectNode) continue
      const symbol = typeChecker.getSymbolAtLocation(objectNode)
      if (!symbol) continue
      if (typeCheckerUtils.resolveToGlobalSymbol(symbol) !== dateSymbol) continue

      const { inEffect } = yield* typeParser.findEnclosingScopes(node)
      if (inEffect !== checkInEffect) continue

      report({ location: node, messageText, fixes: [] })
    }
  })

export const globalDateInEffect = LSP.createDiagnostic({
  name: "globalDateInEffect",
  code: 55,
  description: "Warns when using Date.now() or new Date() inside Effect generators instead of Clock/DateTime",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalDateApply(true)
})
