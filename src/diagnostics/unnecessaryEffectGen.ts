import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryEffectGen = LSP.createDiagnostic({
  name: "unnecessaryEffectGen",
  code: 5,
  apply: Nano.fn("unnecessaryEffectGen.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    return {
      [ts.SyntaxKind.SourceFile]: (sourceFile) =>
        Nano.gen(function*() {
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
                typeParser.unnecessaryEffectGen(node),
                Nano.map(({ replacementNode }) =>
                  report({
                    node,
                    category: ts.DiagnosticCategory.Suggestion,
                    messageText: `This Effect.gen contains a single return statement.`,
                    fixes: [{
                      fixName: "unnecessaryEffectGen_fix",
                      description: "Remove the Effect.gen, and keep the body",
                      apply: Nano.gen(function*() {
                        const textChanges = yield* Nano.service(
                          TypeScriptApi.ChangeTracker
                        )
                        textChanges.replaceNode(sourceFile, node, yield* replacementNode)
                      })
                    }]
                  })
                ),
                Nano.ignore
              )
            }
          }
        })
    }
  })
})
