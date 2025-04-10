import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import { createRefactor } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as TypeParser from "../utils/TypeParser.js"

export const effectGenToFn = createRefactor({
  name: "effect/effectGenToFn",
  description: "Convert to Effect.fn",
  apply: (ts, program) => (sourceFile, textRange) =>
    pipe(
      AST.getNodesContainingRange(ts)(sourceFile, textRange),
      ReadonlyArray.findFirst((node) =>
        Option.gen(function*() {
          // check if the node is a Effect.gen(...)
          const effectGen = yield* TypeParser.effectGen(ts, program.getTypeChecker())(node)
          // if parent is a Effect.gen(...).pipe(...) we then move the pipe tot the new Effect.fn
          let pipeArgs = ts.factory.createNodeArray<ts.Expression>([])
          let nodeToReplace = node.parent
          if (
            ts.isPropertyAccessExpression(node.parent) && node.parent.name.text === "pipe" &&
            ts.isCallExpression(node.parent.parent)
          ) {
            pipeArgs = node.parent.parent.arguments
            nodeToReplace = node.parent.parent.parent
          }
          // then we iterate upwards until we find the function declaration
          while (nodeToReplace) {
            // if arrow function, exit
            if (
              ts.isArrowFunction(nodeToReplace) || ts.isFunctionDeclaration(nodeToReplace) ||
              ts.isMethodDeclaration(nodeToReplace)
            ) {
              return ({ ...effectGen, pipeArgs, nodeToReplace })
            }
            // concise body go up
            if (ts.isConciseBody(nodeToReplace) || ts.isReturnStatement(nodeToReplace)) {
              nodeToReplace = nodeToReplace.parent
              continue
            }
            // function body with only one statement, go up
            if (ts.isBlock(nodeToReplace) && nodeToReplace.statements.length === 1) {
              nodeToReplace = nodeToReplace.parent
              continue
            }
            // exit
            break
          }

          // nothing, exit
          return yield* Option.none()
        })
      ),
      Option.map(
        ({ effectModule, generatorFunction, nodeToReplace, pipeArgs }) => ({
          kind: "refactor.rewrite.effect.effectGenToFn",
          description: "Convert to Effect.fn",
          apply: (changeTracker) => {
            // if we have a name in the function declaration,
            // we call Effect.fn with the name
            const effectFn = nodeToReplace.name && ts.isIdentifier(nodeToReplace.name) ?
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  effectModule,
                  "fn"
                ),
                undefined,
                [ts.factory.createStringLiteral(nodeToReplace.name.text)]
              ) :
              ts.factory.createPropertyAccessExpression(
                effectModule,
                "fn"
              )
            // append the generator and pipe arguments to the Effect.fn call
            const effectFnCallWithGenerator = ts.factory.createCallExpression(
              effectFn,
              undefined,
              [ts.factory.createFunctionExpression(
                undefined,
                ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
                undefined,
                nodeToReplace.typeParameters,
                nodeToReplace.parameters,
                nodeToReplace.type,
                generatorFunction.body
              ) as ts.Expression].concat(pipeArgs)
            )
            changeTracker.replaceNode(
              sourceFile,
              nodeToReplace,
              AST.tryPreserveDeclarationSemantics(ts)(nodeToReplace, effectFnCallWithGenerator)
            )
          }
        })
      )
    )
})
