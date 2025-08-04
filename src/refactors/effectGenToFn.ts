import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const effectGenToFn = LSP.createRefactor({
  name: "effectGenToFn",
  description: "Convert to Effect.fn",
  apply: Nano.fn("effectGenToFn.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const skipReturnBlock = (node: ts.Node) =>
      ts.isBlock(node) && node.statements.length === 1 && ts.isReturnStatement(node.statements[0]) &&
        node.statements[0].expression
        ? node.statements[0].expression
        : node

    const parseFunctionLikeReturnEffectGen = Nano.fn("parseFunctionLikeReturnEffect.apply")(function*(node: ts.Node) {
      if ((ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && node.body) {
        let subject = skipReturnBlock(node.body)
        let pipeArgs: Array<ts.Expression> = []
        while (true) {
          // there may be some .pipe calls, we need to move them to the new Effect.fn
          const maybePipe = yield* Nano.option(typeParser.pipeCall(subject))
          if (Option.isNone(maybePipe)) break
          subject = maybePipe.value.subject
          pipeArgs = maybePipe.value.args.concat(pipeArgs)
        }
        const fnIdentifier = node.name && ts.isIdentifier(node.name)
          ? node.name
          : ts.isVariableDeclaration(node.parent) && node.parent.name && ts.isIdentifier(node.parent.name)
          ? node.parent.name
          : undefined
        const effectGen = yield* typeParser.effectGen(subject)
        return ({ ...effectGen, nodeToReplace: node, pipeArgs, fnIdentifier })
      }
      return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    })

    const parentNodes = tsUtils.getAncestorNodesInRange(sourceFile, textRange)
    if (parentNodes.length === 0) return yield* Nano.fail(new LSP.RefactorNotApplicableError())

    const nodesFromInitializers: Array<ts.Node> = pipe(
      parentNodes,
      Array.filter((_): _ is ts.VariableDeclaration => ts.isVariableDeclaration(_) && _.initializer ? true : false),
      Array.map((_) => _.initializer!)
    )

    const maybeNode = yield* pipe(
      nodesFromInitializers.concat(parentNodes),
      Array.map(parseFunctionLikeReturnEffectGen),
      Nano.firstSuccessOf,
      Nano.option
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const { effectModule, fnIdentifier, generatorFunction, nodeToReplace, pipeArgs } = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.effectGenToFn",
      description: fnIdentifier ? `Convert to Effect.fn("${fnIdentifier.text}")` : "Convert to Effect.fn",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          // if we have a name in the function declaration,
          // we call Effect.fn with the name
          const effectFn = fnIdentifier ?
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                effectModule,
                "fn"
              ),
              undefined,
              [ts.factory.createStringLiteral(fnIdentifier.text)]
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
            tsUtils.tryPreserveDeclarationSemantics(nodeToReplace, effectFnCallWithGenerator)
          )
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
