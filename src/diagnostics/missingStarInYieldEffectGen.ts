import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { ApplicableDiagnosticDefinition } from "../definition.js"
import { createDiagnostic } from "../definition.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const missingStarInYieldEffectGen = createDiagnostic({
  code: 4,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const effectDiagnostics: Array<ApplicableDiagnosticDefinition> = []
      const brokenGenerators = new Set<ts.Node>()
      const brokenYields = new Set<ts.Node>()

      const nodeToVisit: Array<[node: ts.Node, functionStarNode: ts.Node | undefined]> = []
      const appendNodeToVisit = (arg: [node: ts.Node, functionStarNode: ts.Node | undefined]) => {
        nodeToVisit.push(arg)
        return undefined
      }
      ts.forEachChild(sourceFile, (_) => appendNodeToVisit([_, undefined]))

      while (nodeToVisit.length > 0) {
        const [node, functionStarNode] = nodeToVisit.shift()!

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
          ts.forEachChild(effectGenLike.value.body, (_) =>
            appendNodeToVisit([_, effectGenLike.value.functionStar]))
        } // stop when we hit a generator function
        else if (
          (ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) &&
          node.asteriskToken !== undefined
        ) {
          // continue with new parent function star node
          ts.forEachChild(node, (_) =>
            appendNodeToVisit([_, undefined]))
        } else {
          // continue with current parent function star node
          ts.forEachChild(node, (_) => appendNodeToVisit([_, functionStarNode]))
        }
      }

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
    })
})
