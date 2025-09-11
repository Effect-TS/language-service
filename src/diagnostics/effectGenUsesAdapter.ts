import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const effectGenUsesAdapter = LSP.createDiagnostic({
  name: "effectGenUsesAdapter",
  code: 23,
  severity: "warning",
  apply: Nano.fn("effectGenUsesAdapter.apply")(function*(sourceFile, report) {
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
          typeParser.effectGen(node),
          Nano.map(({ generatorFunction }) => {
            // Check if the generator function has parameters and if the first parameter (adapter) is used
            if (generatorFunction.parameters.length > 0) {
              const adapter = generatorFunction.parameters[0]
              // Report diagnostic at the adapter parameter location
              report({
                location: adapter,
                messageText: `The adapter of Effect.gen is not required anymore, it is now just an alias of pipe.`,
                fixes: []
              })
            }
          }),
          Nano.ignore
        )
      }
    }
  })
})
