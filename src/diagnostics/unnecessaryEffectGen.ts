import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const unnecessaryEffectGen = createDiagnostic({
  code: 5,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

      const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
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

        if (Option.isSome(AST.getSingleReturnEffectFromEffectGen(ts, typeChecker, node))) {
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
