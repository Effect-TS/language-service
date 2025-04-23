import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const unnecessaryEffectGen = LSP.createDiagnostic({
  code: 5,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

      const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
      const brokenGenerators = new Set<ts.Node>()

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
          brokenGenerators.add(node)
        }
      }

      // emit diagnostics
      brokenGenerators.forEach((node) =>
        effectDiagnostics.push({
          node,
          category: ts.DiagnosticCategory.Suggestion,
          messageText:
            `This Effect.gen is useless here because it only contains a single return statement.`
        })
      )

      return effectDiagnostics
    })
})
