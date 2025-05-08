import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const unnecessaryEffectGen = LSP.createDiagnostic({
  name: "effect/unnecessaryEffectGen",
  code: 5,
  apply: Nano.fn("unnecessaryEffectGen.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const unnecessaryGenerators = new Map<ts.Node, ts.Node>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const maybeUnnecessaryYield = yield* Nano.option(
        TypeParser.returnYieldEffectBlock(node)
      )

      if (Option.isSome(maybeUnnecessaryYield)) {
        // go up until we meet the causing generator
        const functionStarNode = ts.findAncestor(
          node,
          (_) =>
            (ts.isFunctionExpression(_) || ts.isMethodDeclaration(_)) &&
            _.asteriskToken !== undefined
        )

        // .gen should always be the parent ideally
        if (functionStarNode && functionStarNode.parent) {
          const effectGenNode = functionStarNode.parent
          const maybeUnnecessaryGen = yield* Nano.option(
            TypeParser.effectGen(effectGenNode)
          )
          if (Option.isSome(maybeUnnecessaryGen)) {
            unnecessaryGenerators.set(maybeUnnecessaryGen.value.node, maybeUnnecessaryYield.value)
          }
        }
      }
    }

    // emit diagnostics
    unnecessaryGenerators.forEach((yieldedResult, effectGenCall) =>
      effectDiagnostics.push({
        node: effectGenCall,
        category: ts.DiagnosticCategory.Suggestion,
        messageText:
          `This Effect.gen is useless here because it only contains a single return statement.`,
        fixes: [{
          fixName: "unnecessaryEffectGen_fix",
          description: "Remove the Effect.gen, and keep the body",
          apply: Nano.gen(function*() {
            const textChanges = yield* Nano.service(
              TypeScriptApi.ChangeTracker
            )
            textChanges.replaceNode(sourceFile, effectGenCall, yieldedResult)
          })
        }]
      })
    )

    return effectDiagnostics
  })
})
