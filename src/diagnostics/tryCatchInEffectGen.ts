import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const tryCatchInEffectGen = LSP.createDiagnostic({
  name: "tryCatchInEffectGen",
  code: 12,
  severity: "suggestion",
  apply: Nano.fn("tryCatchInEffectGen.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a try statement
      if (ts.isTryStatement(node)) {
        // Find the containing generator function
        // go up until we meet the causing generator/function
        const generatorOrRegularFunction = ts.findAncestor(
          node,
          (
            _
          ) => (ts.isFunctionExpression(_) || ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_) ||
            ts.isArrowFunction(_) || ts.isGetAccessor(_) || ts.isFunctionLike(_))
        )

        if (
          !(generatorOrRegularFunction && "asteriskToken" in generatorOrRegularFunction &&
            generatorOrRegularFunction.asteriskToken)
        ) continue // fast exit

        if (!generatorOrRegularFunction) continue

        // Check if we're inside Effect.gen or Effect.fn
        if (generatorOrRegularFunction && generatorOrRegularFunction.parent) {
          const effectGenNode = generatorOrRegularFunction.parent

          // Check if this generator is inside Effect.gen/Effect.fn
          yield* pipe(
            typeParser.effectGen(effectGenNode),
            Nano.orElse(() => typeParser.effectFnUntracedGen(effectGenNode)),
            Nano.orElse(() => typeParser.effectFnGen(effectGenNode)),
            Nano.map(() => {
              report({
                node,
                messageText:
                  "Avoid using try/catch inside Effect generators. Use Effect's error handling mechanisms instead (e.g., Effect.try, Effect.tryPromise, Effect.catchAll, Effect.catchTag).",
                fixes: []
              })
            }),
            Nano.ignore
          )
        }
      }
    }
  })
})
