import { pipe } from "effect/Function"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryPipe = LSP.createDiagnostic({
  name: "unnecessaryPipe",
  code: 9,
  apply: Nano.fn("unnecessaryPipe.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    return {
      [ts.SyntaxKind.CallExpression]: (node) =>
        pipe(
          typeParser.pipeCall(node),
          Nano.map(({ args, subject }) => {
            if (args.length === 0) {
              report({
                node,
                category: ts.DiagnosticCategory.Suggestion,
                messageText: `This pipe call contains no arguments.`,
                fixes: [{
                  fixName: "unnecessaryPipe_fix",
                  description: "Remove the pipe call",
                  apply: Nano.gen(function*() {
                    const textChanges = yield* Nano.service(
                      TypeScriptApi.ChangeTracker
                    )
                    textChanges.replaceNode(node.getSourceFile(), node, subject)
                  })
                }]
              })
            }
          }),
          Nano.ignore
        )
    }
  })
})
