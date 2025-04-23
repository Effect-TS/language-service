import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeParser from "../utils/TypeParser.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const missingStarInYieldEffectGen = LSP.createDiagnostic({
  code: 4,
  apply: (sourceFile) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
      const brokenGenerators = new Set<ts.Node>()
      const brokenYields = new Set<ts.Node>()

      const nodeToVisit: Array<[node: ts.Node, functionStarNode: ts.Node | undefined]> = []
      const appendNodeToVisit = (functionStarNode: ts.Node | undefined) => (node: ts.Node) => {
        nodeToVisit.push([node, functionStarNode])
        return undefined
      }
      ts.forEachChild(sourceFile, appendNodeToVisit(undefined))

      while (nodeToVisit.length > 0) {
        const [node, functionStarNode] = nodeToVisit.shift()!

        // error if yield is not followed by *
        if (
          functionStarNode && ts.isYieldExpression(node) && node.expression &&
          node.asteriskToken === undefined
        ) {
          const type = typeChecker.getTypeAtLocation(node.expression)
          const effect = yield* Nano.option(TypeParser.effectType(type, node.expression))
          if (Option.isSome(effect)) {
            brokenGenerators.add(functionStarNode)
            brokenYields.add(node)
          }
        }
        // continue if we hit effect gen-like
        const effectGenLike = yield* pipe(
          TypeParser.effectGen(node),
          Nano.orElse(() => TypeParser.effectFnUntracedGen(node)),
          Nano.orElse(() => TypeParser.effectFnGen(node)),
          Nano.option
        )
        if (Option.isSome(effectGenLike)) {
          ts.forEachChild(
            effectGenLike.value.body,
            appendNodeToVisit(effectGenLike.value.functionStar)
          )
        } // stop when we hit a generator function
        else if (
          (ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) &&
          node.asteriskToken !== undefined
        ) {
          // continue with new parent function star node
          ts.forEachChild(node, appendNodeToVisit(undefined))
        } else {
          // continue with current parent function star node
          ts.forEachChild(node, appendNodeToVisit(functionStarNode))
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
