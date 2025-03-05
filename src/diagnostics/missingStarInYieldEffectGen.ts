import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingStarInYieldEffectGen = createDiagnostic({
  code: 4,
  apply: (ts, program) => (sourceFile) => {
    const typeChecker = program.getTypeChecker()
    const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
    const brokenGenerators = new Set<ts.Node>()
    const brokenYields = new Set<ts.Node>()

    const visit = (functionStarNode: ts.Node | undefined) => (node: ts.Node) => {
      // error if yield is not followed by *
      if (
        functionStarNode && ts.isYieldExpression(node) && node.expression &&
        node.asteriskToken === undefined
      ) {
        const type = typeChecker.getTypeAtLocation(node.expression)
        const effect = TypeParser.effectType(ts, typeChecker)(type, node.expression)
        if (Option.isSome(effect)) {
          brokenGenerators.add(functionStarNode)
          brokenYields.add(node)
        }
      }
      // continue if we hit effect gen-like
      const effectGenLike = pipe(
        TypeParser.effectGen(ts, typeChecker)(node),
        Option.orElse(() => TypeParser.effectFnUntracedGen(ts, typeChecker)(node)),
        Option.orElse(() => TypeParser.effectFnGen(ts, typeChecker)(node))
      )
      if (Option.isSome(effectGenLike)) {
        ts.forEachChild(effectGenLike.value.body, visit(effectGenLike.value.functionStar))
      } // stop when we hit a generator function
      else if (
        (ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) &&
        node.asteriskToken !== undefined
      ) {
        // continue with new parent function star node
        ts.forEachChild(node, visit(undefined))
      } else {
        // continue with current parent function star node
        ts.forEachChild(node, visit(functionStarNode))
      }
    }
    ts.forEachChild(sourceFile, visit(undefined))

    // emit diagnostics
    brokenGenerators.forEach((node) =>
      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Error,
        messageText: `Seems like you used yield instead of yield* inside this Effect.gen.`
      })
    )
    brokenYields.forEach((node) =>
      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Error,
        messageText:
          `When yielding Effects inside Effect.gen, you should use yield* instead of yield.`
      })
    )

    return effectDiagnostics
  }
})
