import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as TypeParser from "../utils/TypeParser.js"

export const floatingEffect = createDiagnostic({
  code: 3,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []

    const visit = (node: ts.Node) => {
      if (
        ts.isExpressionStatement(node) && (ts.isBlock(node.parent) || ts.isSourceFile(node.parent))
      ) {
        const type = typeChecker.getTypeAtLocation(node.expression)
        const effect = TypeParser.effectTypeArguments(ts, typeChecker)(type, node.expression)
        if (Option.isSome(effect)) {
          effectDiagnostics.push({
            node,
            category: ts.DiagnosticCategory.Error,
            messageText: `Effect must be yielded or assigned to a variable.`
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

    return effectDiagnostics
  }
})
