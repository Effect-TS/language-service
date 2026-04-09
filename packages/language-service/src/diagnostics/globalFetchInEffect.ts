import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const makeGlobalFetchApply = (checkInEffect: boolean) =>
  Nano.fn(`globalFetch${checkInEffect ? "InEffect" : ""}.apply`)(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const fetchSymbol = typeChecker.resolveName("fetch", undefined, ts.SymbolFlags.Value, false)
    if (!fetchSymbol) return

    const effectVersion = typeParser.supportedEffect()
    const packageName = effectVersion === "v3" ? "@effect/platform" : "effect/unstable/http"
    const messageText = checkInEffect
      ? `This Effect code calls the global \`fetch\` function, HTTP requests in Effect code are represented through \`HttpClient\` from \`${packageName}\`.`
      : `This code uses the global \`fetch\` function, HTTP requests are represented through \`HttpClient\` from \`${packageName}\`.`

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
        if (symbol && typeCheckerUtils.resolveToGlobalSymbol(symbol) === fetchSymbol) {
          const inEffect =
            ((yield* typeParser.getEffectContextFlags(node)) & TypeParser.EffectContextFlags.InEffect) !== 0
          if (inEffect === checkInEffect) {
            report({
              location: node.expression,
              messageText,
              fixes: []
            })
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })

export const globalFetchInEffect = LSP.createDiagnostic({
  name: "globalFetchInEffect",
  code: 63,
  description: "Warns when using the global fetch function inside Effect generators instead of the Effect HTTP client",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalFetchApply(true)
})
