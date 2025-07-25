import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryPipeChain = LSP.createDiagnostic({
  name: "unnecessaryPipeChain",
  code: 16,
  severity: "suggestion",
  apply: Nano.fn("unnecessaryPipeChain.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
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

      if (ts.isCallExpression(node)) {
        yield* pipe(
          typeParser.pipeCall(node),
          Nano.flatMap((pipeCall) =>
            Nano.map(typeParser.pipeCall(pipeCall.subject), (innerCall) => ({ pipeCall, innerCall }))
          ),
          Nano.map(({ innerCall, pipeCall }) => {
            report({
              location: node,
              messageText: `Chained pipe calls can be simplified to a single pipe call`,
              fixes: [{
                fixName: "unnecessaryPipeChain_fix",
                description: "Rewrite as single pipe call",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(
                    TypeScriptApi.ChangeTracker
                  )
                  switch (innerCall.kind) {
                    case "pipe": {
                      changeTracker.replaceNode(
                        sourceFile,
                        node,
                        ts.factory.createCallExpression(
                          ts.factory.createIdentifier("pipe"),
                          undefined,
                          [innerCall.subject, ...innerCall.args, ...pipeCall.args]
                        )
                      )
                      break
                    }
                    case "pipeable": {
                      changeTracker.replaceNode(
                        sourceFile,
                        node,
                        ts.factory.createCallExpression(
                          ts.factory.createPropertyAccessExpression(
                            innerCall.subject,
                            "pipe"
                          ),
                          undefined,
                          [...innerCall.args, ...pipeCall.args]
                        )
                      )
                      break
                    }
                  }
                })
              }]
            })
          }),
          Nano.ignore
        )
      }
    }
  })
})
