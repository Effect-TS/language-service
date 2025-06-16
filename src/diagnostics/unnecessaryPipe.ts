import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryPipe = LSP.createDiagnostic({
  name: "unnecessaryPipe",
  code: 9,
  apply: Nano.fn("unnecessaryPipe.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const pipeDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const unnecessaryPipes = new Map<ts.Node, ts.Node>()

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
          Nano.map(({ args, subject }) => args.length === 0 ? unnecessaryPipes.set(node, subject) : undefined),
          Nano.ignore
        )
      }
    }

    // emit diagnostics
    unnecessaryPipes.forEach((pipeCall, pipeSubject) =>
      pipeDiagnostics.push({
        node: pipeCall,
        category: ts.DiagnosticCategory.Suggestion,
        messageText: `This pipe call contains no arguments.`,
        fixes: [{
          fixName: "unnecessaryPipe_fix",
          description: "Remove the pipe call",
          apply: Nano.gen(function*() {
            const textChanges = yield* Nano.service(
              TypeScriptApi.ChangeTracker
            )
            textChanges.replaceNode(sourceFile, pipeSubject, pipeCall)
          })
        }]
      })
    )

    return pipeDiagnostics
  })
})
