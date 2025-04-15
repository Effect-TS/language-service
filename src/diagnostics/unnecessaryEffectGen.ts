import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as TypeParser from "../utils/TypeParser.js"

export const unnecessaryEffectGen = createDiagnostic({
  code: 5,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
    const uselessGenerators = new Set<ts.Node>()
    const returnedEffect = new Map<ts.Node, ts.Node>()

    const visit = (node: ts.Node) => {
      // did we hit an effect gen-like?
      const effectGenLike = TypeParser.effectGen(ts, typeChecker)(node)

      if (Option.isSome(effectGenLike)) {
        // if we hit an effect gen-like, we need to check if its body is just a single return statement
        const body = effectGenLike.value.body
        if (
          body.statements.length === 1 &&
          ts.isReturnStatement(body.statements[0]) &&
          body.statements[0].expression &&
          ts.isYieldExpression(body.statements[0].expression) &&
          body.statements[0].expression.expression
        ) {
          // get the type of the node
          const nodeToCheck = body.statements[0].expression.expression
          const type = typeChecker.getTypeAtLocation(nodeToCheck)
          const maybeEffect = TypeParser.effectType(ts, typeChecker)(type, nodeToCheck)
          if (Option.isSome(maybeEffect)) {
            uselessGenerators.add(node)
            returnedEffect.set(node, body.statements[0].expression.expression)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)

    // emit diagnostics
    uselessGenerators.forEach((node) =>
      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Warning,
        messageText:
          `This Effect.gen is useless here because it only contains a single return statement.`,
        fix: Option.fromNullable(returnedEffect.get(node)).pipe(
          Option.map((body) => ({
            description: `Fix: Remove useless Effect.gen`,
            apply: (changeTracker: ts.textChanges.ChangeTracker) =>
              changeTracker.replaceNode(sourceFile, node, body)
          }))
        )
      })
    )

    return effectDiagnostics
  }
})
