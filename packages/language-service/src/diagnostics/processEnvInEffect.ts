import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const isEnvPropertyAccess = (tsApi: typeof ts, node: ts.Node): node is ts.PropertyAccessExpression =>
  tsApi.isPropertyAccessExpression(node) && tsApi.idText(node.name) === "env"

const isProcessEnvMemberAccess = (
  tsApi: typeof ts,
  node: ts.Node
): node is (ts.PropertyAccessExpression | ts.ElementAccessExpression) & { expression: ts.PropertyAccessExpression } =>
  (tsApi.isPropertyAccessExpression(node) || tsApi.isElementAccessExpression(node)) &&
  isEnvPropertyAccess(tsApi, node.expression)

export const makeProcessEnvApply = (checkInEffect: boolean) =>
  Nano.fn(`processEnv${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const processSymbol = typeChecker.resolveName("process", undefined, ts.SymbolFlags.Value, false)
    if (!processSymbol) return

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!isProcessEnvMemberAccess(ts, node)) continue

      const processNode = node.expression.expression
      if (!ts.isIdentifier(processNode) || ts.idText(processNode) !== "process") continue

      const symbol = typeChecker.getSymbolAtLocation(processNode)
      if (!symbol) continue
      if (typeCheckerUtils.resolveToGlobalSymbol(symbol) !== processSymbol) continue

      const inEffect =
        ((yield* typeParser.getEffectContextFlags(node)) & TypeParser.EffectContextFlags.CanYieldEffect) !== 0
      if (inEffect !== checkInEffect) continue

      report({
        location: node,
        messageText: checkInEffect
          ? "This Effect code reads from `process.env`, environment configuration in Effect code is represented through `Config` from Effect."
          : "This code reads from `process.env`, environment configuration is represented through `Config` from Effect.",
        fixes: []
      })
    }
  })

export const processEnvInEffect = LSP.createDiagnostic({
  name: "processEnvInEffect",
  code: 65,
  description: "Warns when reading process.env inside Effect generators instead of using Effect Config",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeProcessEnvApply(true)
})
