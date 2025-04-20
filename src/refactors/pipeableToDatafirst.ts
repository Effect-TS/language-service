import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"

export const pipeableToDatafirst = createRefactor({
  name: "effect/pipeableToDatafirst",
  description: "Rewrite to datafirst",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
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
          const a = AST.asDataFirstExpression(ts, program.getTypeChecker())(arg, newNode)
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
      ReadonlyArray.head,
      Option.map(([node, newNode]) => ({
        kind: "refactor.rewrite.effect.pipeableToDatafirst",
        description: "Rewrite to datafirst",
        apply: (changeTracker) => {
          changeTracker.replaceNode(sourceFile, node, newNode)
        }
      }))
    )
})
