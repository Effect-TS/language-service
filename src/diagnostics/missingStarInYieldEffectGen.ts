import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const missingStarInYieldEffectGen = LSP.createDiagnostic({
  name: "missingStarInYieldEffectGen",
  code: 4,
  apply: Nano.fn("missingStarInYieldEffectGen.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const brokenGenerators = new Set<ts.Node>()
    const brokenYields = new Set<ts.YieldExpression>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // error if yield is not followed by *
      if (
        ts.isYieldExpression(node) && node.expression &&
        node.asteriskToken === undefined
      ) {
        // go up until we meet the causing generator
        const functionStarNode = ts.findAncestor(
          node,
          (_) => (ts.isFunctionExpression(_) || ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_))
        )

        // .gen should always be the parent ideally
        if (functionStarNode && functionStarNode.parent) {
          const effectGenNode = functionStarNode.parent
          // continue if we hit effect gen-like
          const effectGenLike = yield* pipe(
            TypeParser.effectGen(effectGenNode),
            Nano.orElse(() => TypeParser.effectFnUntracedGen(effectGenNode)),
            Nano.orElse(() => TypeParser.effectFnGen(effectGenNode)),
            Nano.option
          )
          if (Option.isSome(effectGenLike)) {
            if (effectGenLike.value.functionStar) {
              brokenGenerators.add(effectGenLike.value.functionStar)
            }
            brokenYields.add(node)
          }
        }
      }
    }

    // emit diagnostics
    brokenGenerators.forEach((node) =>
      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Error,
        messageText: `Seems like you used yield instead of yield* inside this Effect.gen.`,
        fixes: []
      })
    )
    brokenYields.forEach((node) => {
      const fix = node.expression ?
        [{
          fixName: "missingStarInYieldEffectGen_fix",
          description: "Replace yield with yield*",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

            changeTracker.replaceNode(
              sourceFile,
              node,
              ts.factory.createYieldExpression(
                ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
                node.expression!
              )
            )
          })
        }] :
        []

      effectDiagnostics.push({
        node,
        category: ts.DiagnosticCategory.Error,
        messageText: `When yielding Effects inside Effect.gen, you should use yield* instead of yield.`,
        fixes: fix
      })
    })

    return effectDiagnostics
  })
})
