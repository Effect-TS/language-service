import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const pipeableToDatafirst = LSP.createRefactor({
  name: "pipeableToDatafirst",
  description: "Rewrite to datafirst",
  apply: Nano.fn("pipeableToDatafirst.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    function isPipeCall(node: ts.Node): node is ts.CallExpression {
      if (!ts.isCallExpression(node)) return false
      const expression = node.expression
      if (!ts.isIdentifier(expression)) return false
      if (expression.text !== "pipe") return false
      return true
    }

    function asDataFirstExpression(
      node: ts.Node,
      self: ts.Expression
    ): Option.Option<ts.CallExpression> {
      if (!ts.isCallExpression(node)) return Option.none()
      const signature = typeChecker.getResolvedSignature(node)
      if (!signature) return Option.none()
      const callSignatures = typeChecker.getTypeAtLocation(node.expression).getCallSignatures()
      for (let i = 0; i < callSignatures.length; i++) {
        const callSignature = callSignatures[i]
        if (callSignature.parameters.length === node.arguments.length + 1) {
          return Option.some(
            ts.factory.createCallExpression(
              node.expression,
              [],
              [self].concat(node.arguments)
            )
          )
        }
      }
      return Option.none()
    }

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter(isPipeCall),
      Array.filter((node) => tsUtils.isNodeInRange(textRange)(node.expression)),
      Array.filter(
        (node) => node.arguments.length > 0
      ),
      Array.map((node) => {
        let newNode = node.arguments[0]
        let didSomething = false
        for (let i = 1; i < node.arguments.length; i++) {
          const arg = node.arguments[i]
          const a = asDataFirstExpression(arg, newNode)
          if (Option.isSome(a)) {
            // use found datafirst
            newNode = a.value
            didSomething = true
          } else {
            if (isPipeCall(newNode)) {
              // avoid nested pipe(a, pipe(b, c))
              newNode = ts.factory.createCallExpression(
                ts.factory.createIdentifier("pipe"),
                [],
                newNode.arguments.concat([arg])
              )
            } else {
              // no datafirst, keep pipeable
              newNode = ts.factory.createCallExpression(ts.factory.createIdentifier("pipe"), [], [
                newNode,
                arg
              ])
            }
          }
        }
        return didSomething ? Option.some([node, newNode] as const) : Option.none()
      }),
      Array.filter(Option.isSome),
      Array.map((_) => _.value),
      Array.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const [node, newNode] = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.pipeableToDatafirst",
      description: "Rewrite to datafirst",
      apply: Nano.gen(function*() {
        const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
        changeTracker.replaceNode(sourceFile, node, newNode)
      })
    })
  })
})
