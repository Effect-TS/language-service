import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const returnEffectInGen = LSP.createDiagnostic({
  name: "returnEffectInGen",
  code: 11,
  apply: Nano.fn("returnEffectInGen.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    return {
      [ts.SyntaxKind.SourceFile]: (sourceFile) =>
        Nano.gen(function*() {
          const brokenReturnStatements = new Set<ts.ReturnStatement>()

          const nodeToVisit: Array<ts.Node> = []
          const appendNodeToVisit = (node: ts.Node) => {
            nodeToVisit.push(node)
            return undefined
          }
          ts.forEachChild(sourceFile, appendNodeToVisit)

          while (nodeToVisit.length > 0) {
            const node = nodeToVisit.shift()!
            ts.forEachChild(node, appendNodeToVisit)

            // start from the return statement
            if (
              ts.isReturnStatement(node) && node.expression
            ) {
              // fast exit
              if (ts.isYieldExpression(node.expression)) continue

              // go up until we meet the causing generator/function
              const generatorOrRegularFunction = ts.findAncestor(
                node,
                (
                  _
                ) => (ts.isFunctionExpression(_) || ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_) ||
                  ts.isArrowFunction(_) || ts.isGetAccessor(_))
              )

              if (
                !(generatorOrRegularFunction && "asteriskToken" in generatorOrRegularFunction &&
                  generatorOrRegularFunction.asteriskToken)
              ) continue // fast exit

              // are we returning an effect with never as success type?
              const type = typeChecker.getTypeAtLocation(node.expression)
              const maybeEffect = yield* Nano.option(typeParser.effectType(type, node.expression))

              if (Option.isSome(maybeEffect)) {
                // ok to return effect subtype
                const maybeEffectSubtype = yield* Nano.option(typeParser.effectSubtype(type, node.expression))
                if (Option.isNone(maybeEffectSubtype)) {
                  // .gen should always be the parent ideally
                  if (generatorOrRegularFunction && generatorOrRegularFunction.parent) {
                    const effectGenNode = generatorOrRegularFunction.parent
                    // continue if we hit effect gen-like
                    yield* pipe(
                      typeParser.effectGen(effectGenNode),
                      Nano.orElse(() => typeParser.effectFnUntracedGen(effectGenNode)),
                      Nano.orElse(() => typeParser.effectFnGen(effectGenNode)),
                      Nano.map(() => brokenReturnStatements.add(node)),
                      Nano.ignore
                    )
                  }
                }
              }
            }
          }

          // emit diagnostics
          brokenReturnStatements.forEach((node) => {
            const fix = node.expression ?
              [{
                fixName: "returnEffectInGen_fix",
                description: "Add yield* statement",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  changeTracker.replaceNode(
                    sourceFile,
                    node.expression!,
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
              category: ts.DiagnosticCategory.Suggestion,
              messageText:
                `You are returning an Effect-able type inside a generator function, and will result in nested Effect<Effect<...>>. Maybe you wanted to return yield* instead? Nested Effect-able types may be intended if you plan to later manually flatten or unwrap this Effect.`,
              fixes: fix
            })
          })
        })
    }
  })
})
