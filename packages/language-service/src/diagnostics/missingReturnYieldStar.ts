import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const missingReturnYieldStar = LSP.createDiagnostic({
  name: "missingReturnYieldStar",
  code: 7,
  description: "Suggests using 'return yield*' for Effects with never success for better type narrowing",
  severity: "error",
  apply: Nano.fn("missingReturnYieldStar.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Start from expression statements only so the fix is always structurally safe.
      if (!ts.isExpressionStatement(node)) continue
      const unwrapped = tsUtils.skipOuterExpressions(node.expression)
      if (!ts.isYieldExpression(unwrapped) || !unwrapped.expression || !unwrapped.asteriskToken) continue

      const type = typeCheckerUtils.getTypeAtLocation(unwrapped.expression)
      if (!type) continue

      const maybeEffect = yield* Nano.option(typeParser.effectType(type, unwrapped.expression))
      if (!(Option.isSome(maybeEffect) && maybeEffect.value.A.flags & ts.TypeFlags.Never)) continue

      // Ensure we're in the direct body scope of an Effect.gen-like function.
      const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
      if (!effectGen || (scopeNode && scopeNode !== effectGen.generatorFunction)) continue

      const fix = [{
        fixName: "missingReturnYieldStar_fix",
        description: "Add return statement",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          changeTracker.replaceNode(
            sourceFile,
            node,
            ts.factory.createReturnStatement(node.expression)
          )
        })
      }]

      report({
        location: unwrapped,
        messageText:
          `It is recommended to use return yield* for Effects that never succeed to signal a definitive exit point for type narrowing and tooling support.`,
        fixes: fix
      })
    }
  })
})
