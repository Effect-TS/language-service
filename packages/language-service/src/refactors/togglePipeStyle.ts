import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const togglePipeStyle = LSP.createRefactor({
  name: "togglePipeStyle",
  description: "Toggle pipe style",
  apply: Nano.fn("togglePipeStyle.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const togglePipeStyle = (node: ts.Node) =>
      Nano.gen(function*() {
        const pipeCall = yield* typeParser.pipeCall(node)
        switch (pipeCall.kind) {
          case "pipe": {
            yield* typeParser.pipeableType(typeChecker.getTypeAtLocation(pipeCall.subject), pipeCall.subject)
            return ({
              kind: "refactor.rewrite.effect.togglePipeStyle",
              description: "Rewrite as X.pipe(Y, Z, ...)",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                changeTracker.replaceNode(
                  sourceFile,
                  node,
                  ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                      pipeCall.subject,
                      "pipe"
                    ),
                    undefined,
                    pipeCall.args
                  )
                )
              })
            })
          }
          case "pipeable":
            return ({
              kind: "refactor.rewrite.effect.togglePipeStyle",
              description: "Rewrite as pipe(X, Y, Z, ...)",
              apply: Nano.gen(function*() {
                const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
                changeTracker.replaceNode(
                  sourceFile,
                  node,
                  ts.factory.createCallExpression(
                    ts.factory.createIdentifier("pipe"),
                    undefined,
                    [pipeCall.subject].concat(pipeCall.args)
                  )
                )
              })
            })
        }
      })

    const ancestorNodes = tsUtils.getAncestorNodesInRange(sourceFile, textRange)

    return yield* pipe(
      Nano.firstSuccessOf(ancestorNodes.map(togglePipeStyle)),
      Nano.orElse(() => Nano.fail(new LSP.RefactorNotApplicableError()))
    )
  })
})
