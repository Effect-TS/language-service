import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const lazyPromiseInEffectSync = LSP.createDiagnostic({
  name: "lazyPromiseInEffectSync",
  code: 70,
  description: "Warns when Effect.sync lazily returns a Promise instead of using an async Effect constructor",
  group: "antipattern",
  severity: "warning",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("lazyPromiseInEffectSync.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

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

      const isSyncCall = yield* Nano.orUndefined(
        typeParser.isNodeReferenceToEffectModuleApi("sync")(node.expression)
      )
      if (!isSyncCall) continue

      const lazyArg = node.arguments[0]
      if (!lazyArg) continue

      const lazyArgType = typeCheckerUtils.getTypeAtLocation(lazyArg)
      if (!lazyArgType) continue

      const entries = typeCheckerUtils.unrollUnionMembers(lazyArgType).flatMap((member) =>
        typeChecker.getSignaturesOfType(member, ts.SignatureKind.Call).map((signature) =>
          typeParser.promiseType(typeChecker.getReturnTypeOfSignature(signature), lazyArg)
        )
      )
      if (entries.length === 0) continue

      const promiseReturn = yield* Nano.orUndefined(Nano.firstSuccessOf(entries))
      if (!promiseReturn) continue

      report({
        location: lazyArg,
        messageText:
          "This `Effect.sync` thunk returns a Promise. Use `Effect.promise` or `Effect.tryPromise` to represent async work.",
        fixes: []
      })
    }
  })
})
