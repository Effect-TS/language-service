import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const returnEffectInGen = LSP.createDiagnostic({
  name: "returnEffectInGen",
  code: 11,
  description: "Warns when returning an Effect in a generator causes nested Effect<Effect<...>>",
  group: "antipattern",
  severity: "suggestion",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("returnEffectInGen.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
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
        const type = typeCheckerUtils.getTypeAtLocation(node.expression)
        if (!type) continue
        const maybeEffect = yield* Nano.option(typeParser.strictEffectType(type, node.expression))

        if (Option.isSome(maybeEffect)) {
          // .gen should always be the parent ideally
          if (generatorOrRegularFunction && generatorOrRegularFunction.parent) {
            const effectGenNode = generatorOrRegularFunction.parent
            // continue if we hit effect gen-like
            yield* pipe(
              typeParser.effectGen(effectGenNode),
              Nano.orElse(() => typeParser.effectFnUntracedGen(effectGenNode)),
              Nano.orElse(() => typeParser.effectFnGen(effectGenNode)),
              Nano.map(() => {
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
                  location: node,
                  messageText:
                    "This generator returns an Effect-able value directly, which produces a nested `Effect<Effect<...>>`. If the intended result is the inner Effect value, `return yield*` represents that form.",
                  fixes: fix
                })
              }),
              Nano.ignore
            )
          }
        }
      }
    }
  })
})
