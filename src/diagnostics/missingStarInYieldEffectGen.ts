import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missingStarInYieldEffectGen = LSP.createDiagnostic({
  name: "missingStarInYieldEffectGen",
  code: 4,
  apply: Nano.fn("missingStarInYieldEffectGen.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    return {
      [ts.SyntaxKind.SourceFile]: (sourceFile) =>
        Nano.gen(function*() {
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
                yield* pipe(
                  typeParser.effectGen(effectGenNode),
                  Nano.orElse(() => typeParser.effectFnUntracedGen(effectGenNode)),
                  Nano.orElse(() => typeParser.effectFnGen(effectGenNode)),
                  Nano.map(({ functionStar }) => {
                    if (functionStar) {
                      brokenGenerators.add(functionStar)
                    }
                    brokenYields.add(node)
                  }),
                  Nano.ignore
                )
              }
            }
          }

          // emit diagnostics
          brokenGenerators.forEach((node) =>
            report({
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

            report({
              node,
              category: ts.DiagnosticCategory.Error,
              messageText: `When yielding Effects inside Effect.gen, you should use yield* instead of yield.`,
              fixes: fix
            })
          })
        })
    }
  })
})
