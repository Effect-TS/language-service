import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const unnecessaryEffectGen = LSP.createDiagnostic({
  name: "unnecessaryEffectGen",
  code: 5,
  apply: Nano.fn("unnecessaryEffectGen.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const unnecessaryGenerators = new Map<ts.Node, Nano.Nano<ts.Node>>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      yield* pipe(
        TypeParser.unnecessaryEffectGen(node),
        Nano.map(({ replacementNode }) => unnecessaryGenerators.set(node, replacementNode)),
        Nano.ignore
      )
    }

    // emit diagnostics
    unnecessaryGenerators.forEach((yieldedResult, effectGenCall) =>
      effectDiagnostics.push({
        node: effectGenCall,
        category: ts.DiagnosticCategory.Suggestion,
        messageText: `This Effect.gen contains a single return statement.`,
        fixes: [{
          fixName: "unnecessaryEffectGen_fix",
          description: "Remove the Effect.gen, and keep the body",
          apply: Nano.gen(function*() {
            const textChanges = yield* Nano.service(
              TypeScriptApi.ChangeTracker
            )
            textChanges.replaceNode(sourceFile, effectGenCall, yield* yieldedResult)
          })
        }]
      })
    )

    return effectDiagnostics
  })
})
