import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const effectGenToFn = LSP.createRefactor({
  name: "effectGenToFn",
  description: "Convert to Effect.fn",
  apply: Nano.fn("effectGenToFn.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const parseEffectGenNode = Nano.fn("asyncAwaitToGen.apply")(function*(node: ts.Node) {
      // check if the node is a Effect.gen(...)
      const effectGen = yield* TypeParser.effectGen(node)
      // if parent is a Effect.gen(...).pipe(...) we then move the pipe tot the new Effect.fn
      let pipeArgs = ts.factory.createNodeArray<ts.Expression>([])
      let nodeToReplace = node

      // then we iterate upwards until we find the function declaration
      while (nodeToReplace.parent) {
        const parent = nodeToReplace.parent
        // if parent is arrow, exit
        if (
          ts.isConciseBody(nodeToReplace) && ts.isArrowFunction(parent) &&
          parent.body === nodeToReplace
        ) {
          return ({ ...effectGen, pipeArgs, nodeToReplace: parent })
        }
        // if parent is a method
        if (
          (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) &&
          parent.body === nodeToReplace
        ) {
          return ({ ...effectGen, pipeArgs, nodeToReplace: parent })
        }
        // function body with only one statement, go up
        if (
          ts.isBlock(parent) && parent.statements.length === 1 &&
          parent.statements[0] === nodeToReplace
        ) {
          nodeToReplace = parent
          continue
        }
        // parent is a return and this is the expression
        if (ts.isReturnStatement(parent) && parent.expression === nodeToReplace) {
          nodeToReplace = parent
          continue
        }
        // if parent is a .pipe, and gen is the subject piped
        // if parent is a pipe(gen(), ..., ...) and gen is the first subject piped
        const maybePipe = yield* pipe(
          AST.parsePipeCall(parent),
          Nano.orElse((e) => parent.parent ? AST.parsePipeCall(parent.parent) : Nano.fail(e)),
          Nano.option
        )
        if (
          Option.isSome(maybePipe) &&
          maybePipe.value.subject === nodeToReplace
        ) {
          pipeArgs = ts.factory.createNodeArray(pipeArgs.concat(maybePipe.value.args))
          nodeToReplace = maybePipe.value.node
          continue
        }
        // exit
        break
      }
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    })

    const maybeNode = yield* pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, textRange),
      ReadonlyArray.map(parseEffectGenNode),
      Nano.firstSuccessOf,
      Nano.option
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const { effectModule, generatorFunction, nodeToReplace, pipeArgs } = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.effectGenToFn",
      description: "Convert to Effect.fn",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

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
            yield* AST.tryPreserveDeclarationSemantics(nodeToReplace, effectFnCallWithGenerator)
          )
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
