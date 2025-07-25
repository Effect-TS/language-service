import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missingReturnYieldStar = LSP.createDiagnostic({
  name: "missingReturnYieldStar",
  code: 7,
  severity: "error",
  apply: Nano.fn("missingReturnYieldStar.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
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

      // if we yield* an effect with never in success type, maybe we wanted tu return
      if (
        ts.isYieldExpression(node) && node.expression &&
        node.asteriskToken
      ) {
        // are we returning an effect with never as success type?
        const type = typeChecker.getTypeAtLocation(node.expression)
        const maybeEffect = yield* Nano.option(typeParser.effectType(type, node.expression))

        if (Option.isSome(maybeEffect) && maybeEffect.value.A.flags & ts.TypeFlags.Never) {
          // go up until we meet the causing generator
          const generatorFunctionOrReturnStatement = ts.findAncestor(
            node,
            (
              _
            ) => (ts.isFunctionExpression(_) || ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_) ||
              ts.isReturnStatement(_) || ts.isThrowStatement(_))
          )

          // we already have a return statement
          if (
            generatorFunctionOrReturnStatement && !ts.isReturnStatement(generatorFunctionOrReturnStatement) &&
            !ts.isThrowStatement(generatorFunctionOrReturnStatement)
          ) {
            // .gen should always be the parent ideally
            if (generatorFunctionOrReturnStatement && generatorFunctionOrReturnStatement.parent) {
              const effectGenNode = generatorFunctionOrReturnStatement.parent
              // continue if we hit effect gen-like
              const effectGenLike = yield* pipe(
                typeParser.effectGen(effectGenNode),
                Nano.orElse(() => typeParser.effectFnUntracedGen(effectGenNode)),
                Nano.orElse(() => typeParser.effectFnGen(effectGenNode)),
                Nano.option
              )
              if (Option.isSome(effectGenLike)) {
                // emit diagnostic
                const fix = node.expression ?
                  [{
                    fixName: "missingReturnYieldStar_fix",
                    description: "Add return statement",
                    apply: Nano.gen(function*() {
                      const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                      changeTracker.replaceNode(
                        sourceFile,
                        node,
                        ts.factory.createReturnStatement(
                          node
                        )
                      )
                    })
                  }] :
                  []

                report({
                  location: node,
                  messageText: `Yielded Effect never succeeds, so it is best to use a 'return yield*' instead.`,
                  fixes: fix
                })
              }
            }
          }
        }
      }
    }
  })
})
