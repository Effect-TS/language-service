import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const unnecessaryEffectGen = LSP.createDiagnostic({
  name: "effect/unnecessaryEffectGen",
  code: 5,
  apply: Nano.fn("unnecessaryEffectGen.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const unnecessaryGenerators = new Map<ts.Node, ts.Node>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const maybeUnnecessaryGen = yield* pipe(
        TypeParser.effectGen(node),
        Nano.flatMap(({ body }) => TypeParser.returnYieldEffectBlock(body)),
        Nano.option
      )

      if (Option.isSome(maybeUnnecessaryGen)) {
        unnecessaryGenerators.set(node, maybeUnnecessaryGen.value)
      }
    }

    // emit diagnostics
    unnecessaryGenerators.forEach((body, node) =>
      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Suggestion,
        messageText:
          `This Effect.gen is useless here because it only contains a single return statement.`,
        fix: Option.some({
          fixName: "unnecessaryEffectGen_fix",
          description: "Remove the Effect.gen, and keep the body",
          apply: Nano.gen(function*() {
            const textChanges = yield* Nano.service(
              TypeScriptApi.ChangeTracker
            )
            textChanges.replaceNode(sourceFile, node, body)
          })
        })
      })
    )

    return effectDiagnostics
  })
})
