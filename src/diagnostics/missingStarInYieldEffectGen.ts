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

    const visitWhileInGenerator = (node: ts.Node) => {
      // error if yield is not followed by *
      if (
        ts.isYieldExpression(node) && node.expression && node.asteriskToken === undefined
      ) {
        const type = typeChecker.getTypeAtLocation(node.expression)
        const effect = TypeParser.effectTypeArguments(ts, typeChecker)(type, node.expression)
        if (Option.isSome(effect)) {
          effectDiagnostics.push({
            node,
            category: ts.DiagnosticCategory.Error,
            messageText:
              `When yielding Effects inside Effect.gen, you should use yield* instead of yield.`
          })
        }
      }
      // continue if we hit another effect gen
      const effectGen = TypeParser.effectGen(ts, typeChecker)(node)
      if (Option.isSome(effectGen)) {
        ts.forEachChild(effectGen.value.body, visitWhileInGenerator)
      } // stop when we hit a generator function
      else if (
        (ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) &&
        node.asteriskToken !== undefined
      ) {
        ts.forEachChild(node, visit)
      } else {
        // any other node
        ts.forEachChild(node, visitWhileInGenerator)
      }
    }

    const visit = (node: ts.Node) => {
      const effectGen = TypeParser.effectGen(ts, typeChecker)(node)
      if (Option.isSome(effectGen)) {
        ts.forEachChild(effectGen.value.body, visitWhileInGenerator)
      } else {
        ts.forEachChild(node, visit)
      }
    }

    ts.forEachChild(sourceFile, visit)

    return effectDiagnostics
  }
})
