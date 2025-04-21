import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeCheckerApi from "../utils/TypeCheckerApi.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const pipeableToDatafirst = createRefactor({
  name: "effect/pipeableToDatafirst",
  description: "Rewrite to datafirst",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
      const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

      const maybeNode = pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter(AST.isPipeCall(ts)),
        ReadonlyArray.filter((node) => AST.isNodeInRange(textRange)(node.expression)),
        ReadonlyArray.filter(
          (node) => node.arguments.length > 0
        ),
        ReadonlyArray.map((node) => {
          let newNode = node.arguments[0]
          let didSomething = false
          for (let i = 1; i < node.arguments.length; i++) {
            const arg = node.arguments[i]
            const a = AST.asDataFirstExpression(ts, typeChecker)(arg, newNode)
            if (Option.isSome(a)) {
              // use found datafirst
              newNode = a.value
              didSomething = true
            } else {
              if (AST.isPipeCall(ts)(newNode)) {
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
        ReadonlyArray.filter(Option.isSome),
        ReadonlyArray.map((_) => _.value),
        ReadonlyArray.head
      )

      if (Option.isNone(maybeNode)) return yield* Nano.fail(new RefactorNotApplicableError())
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
