import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as AST from "../utils/AST.js"

export const unnecessaryEffectGen = createDiagnostic({
  code: 5,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
    const brokenGenerators = new Set<ts.Node>()

    const visit = (node: ts.Node) => {
      if (Option.isSome(AST.getSingleReturnEffectFromEffectGen(typeChecker, node))) {
        brokenGenerators.add(node)
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

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
  }
})
