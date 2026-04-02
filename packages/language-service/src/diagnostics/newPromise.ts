import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const newPromise = LSP.createDiagnostic({
  name: "newPromise",
  code: 68,
  description: "Warns when constructing promises with new Promise instead of using Effect APIs",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("newPromise.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const promiseSymbol = typeChecker.resolveName("Promise", undefined, ts.SymbolFlags.Value, false)
    if (!promiseSymbol) return

    const visit = (node: ts.Node) => {
      if (ts.isNewExpression(node)) {
        const symbol = typeChecker.getSymbolAtLocation(node.expression)
        if (symbol && typeCheckerUtils.resolveToGlobalSymbol(symbol) === promiseSymbol) {
          report({
            location: node,
            messageText:
              "This code constructs `new Promise(...)`, prefer Effect APIs such as `Effect.async`, `Effect.promise`, or `Effect.tryPromise` instead of manual Promise construction.",
            fixes: []
          })
        }
      }

      ts.forEachChild(node, visit)
      return undefined
    }

    ts.forEachChild(sourceFile, visit)
  })
})
