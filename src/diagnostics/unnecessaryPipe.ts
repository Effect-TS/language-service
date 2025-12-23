import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryPipe = LSP.createDiagnostic({
  name: "unnecessaryPipe",
  code: 9,
  description: "Removes pipe calls with no arguments",
  severity: "suggestion",
  apply: Nano.fn("unnecessaryPipe.apply")(function*(sourceFile, report) {
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
          Nano.map(({ args, subject }) => {
            if (args.length === 0) {
              report({
                location: node,
                messageText: `This pipe call contains no arguments.`,
                fixes: [{
                  fixName: "unnecessaryPipe_fix",
                  description: "Remove the pipe call",
                  apply: Nano.gen(function*() {
                    const textChanges = yield* Nano.service(
                      TypeScriptApi.ChangeTracker
                    )
                    textChanges.replaceNode(sourceFile, node, subject)
                  })
                }]
              })
            }
          }),
          Nano.ignore
        )
      }
    }
  })
})
