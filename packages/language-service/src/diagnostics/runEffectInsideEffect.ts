import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const runEffectInsideEffect = LSP.createDiagnostic({
  name: "runEffectInsideEffect",
  code: 32,
  description: "Suggests using Runtime or Effect.run*With methods instead of Effect.run* inside Effect contexts",
  group: "antipattern",
  severity: "suggestion",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("runEffectInsideEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const supportedEffect = typeParser.supportedEffect()

    const getContainingFunctionLike = (node: ts.Node): ts.FunctionLikeDeclaration | undefined => {
      for (let current = node.parent; current; current = current.parent) {
        if (
          ts.isFunctionExpression(current) ||
          ts.isFunctionDeclaration(current) ||
          ts.isMethodDeclaration(current) ||
          ts.isArrowFunction(current) ||
          ts.isGetAccessorDeclaration(current) ||
          ts.isSetAccessorDeclaration(current)
        ) {
          return current
        }
      }
      return undefined
    }

    const parseEffectMethod = (node: ts.Node, methodName: string) =>
      pipe(
        typeParser.isNodeReferenceToEffectModuleApi(methodName)(node),
        Nano.map(() => ({ node, methodName }))
      )

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a call expression
      if (!ts.isCallExpression(node)) continue
      if (node.arguments.length === 0) continue

      // Verify it's actually an Effect module call using TypeParser
      const isEffectRunCall = yield* pipe(
        parseEffectMethod(node.expression, "runPromise"),
        Nano.orElse(() => parseEffectMethod(node.expression, "runSync")),
        Nano.orElse(() => parseEffectMethod(node.expression, "runFork")),
        Nano.orElse(() => parseEffectMethod(node.expression, "runCallback")),
        Nano.option
      )

      if (Option.isNone(isEffectRunCall)) continue

      const scopeNode = getContainingFunctionLike(node)
      let generatorFunction = yield* typeParser.getEffectYieldGeneratorFunction(node)

      if (!generatorFunction) {
        for (let current = node.parent; current; current = current.parent) {
          const currentFlags = yield* typeParser.getEffectContextFlags(current)
          if ((currentFlags & TypeParser.EffectContextFlags.CanYieldEffect) === 0) continue
          generatorFunction = yield* typeParser.getEffectYieldGeneratorFunction(current)
          if (generatorFunction) break
        }
      }

      let effectGen: {
        node: ts.Node
        effectModule: ts.Node | ts.Expression
        generatorFunction: ts.FunctionExpression
        body: ts.Block
        pipeArguments?: ReadonlyArray<ts.Expression>
      } | undefined = undefined

      if (generatorFunction) {
        for (let current = generatorFunction.parent; current; current = current.parent) {
          effectGen = yield* pipe(
            typeParser.effectGen(current),
            Nano.map((result) => ({
              node: result.node,
              effectModule: result.effectModule,
              generatorFunction: result.generatorFunction,
              body: result.body
            })),
            Nano.orElse(() =>
              pipe(
                typeParser.effectFnUntracedGen(current),
                Nano.map((result) => ({
                  node: result.node,
                  effectModule: result.effectModule,
                  generatorFunction: result.generatorFunction,
                  body: result.body,
                  pipeArguments: result.pipeArguments
                }))
              )
            ),
            Nano.orElse(() =>
              pipe(
                typeParser.effectFnGen(current),
                Nano.map((result) => ({
                  node: result.node,
                  effectModule: result.effectModule,
                  generatorFunction: result.generatorFunction,
                  body: result.body,
                  pipeArguments: result.pipeArguments
                }))
              )
            ),
            Nano.orUndefined
          )

          if (effectGen) break
        }
      }

      if (effectGen && effectGen.body.statements.length > 0) {
        const nodeText = sourceFile.text.substring(
          ts.getTokenPosOfNode(node.expression, sourceFile),
          node.expression.end
        )

        if (scopeNode && scopeNode !== effectGen.generatorFunction) {
          const fixAddRuntime = Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            const effectModuleIdentifier =
              tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Effect") || "Effect"
            const runtimeModuleIdentifier =
              tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Runtime") ||
              "Runtime"
            let runtimeIdentifier: string | undefined = undefined
            let servicesIdentifier: string | undefined = undefined
            for (const statement of effectGen.generatorFunction.body.statements) {
              if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
                const declaration = statement.declarationList.declarations[0]
                if (
                  declaration.initializer && ts.isYieldExpression(declaration.initializer) &&
                  declaration.initializer.asteriskToken && declaration.initializer.expression
                ) {
                  const yieldedExpression = declaration.initializer.expression
                  if (ts.isCallExpression(yieldedExpression)) {
                    const maybeEffectRuntime = yield* pipe(
                      typeParser.isNodeReferenceToEffectModuleApi("runtime")(yieldedExpression.expression),
                      Nano.option
                    )
                    if (Option.isSome(maybeEffectRuntime) && ts.isIdentifier(declaration.name)) {
                      runtimeIdentifier = ts.idText(declaration.name)
                    }
                    const maybeEffectServices = yield* pipe(
                      typeParser.isNodeReferenceToEffectModuleApi("services")(yieldedExpression.expression),
                      Nano.option
                    )
                    if (Option.isSome(maybeEffectServices) && ts.isIdentifier(declaration.name)) {
                      servicesIdentifier = ts.idText(declaration.name)
                    }
                  }
                }
              }
            }
            if (supportedEffect === "v4" && !servicesIdentifier) {
              changeTracker.insertNodeAt(
                sourceFile,
                effectGen.body.statements[0].pos,
                ts.factory.createVariableStatement(
                  undefined,
                  ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration(
                    "effectServices",
                    undefined,
                    undefined,
                    ts.factory.createYieldExpression(
                      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
                      ts.factory.createCallExpression(
                        ts.factory.createPropertyAccessExpression(
                          ts.factory.createIdentifier(effectModuleIdentifier),
                          "services"
                        ),
                        [ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword)],
                        []
                      )
                    )
                  )], ts.NodeFlags.Const)
                ),
                {
                  prefix: "\n",
                  suffix: "\n"
                }
              )
            } else if (supportedEffect === "v3" && !runtimeIdentifier) {
              changeTracker.insertNodeAt(
                sourceFile,
                effectGen.body.statements[0].pos,
                ts.factory.createVariableStatement(
                  undefined,
                  ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration(
                    "effectRuntime",
                    undefined,
                    undefined,
                    ts.factory.createYieldExpression(
                      ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
                      ts.factory.createCallExpression(
                        ts.factory.createPropertyAccessExpression(
                          ts.factory.createIdentifier(effectModuleIdentifier),
                          "runtime"
                        ),
                        [ts.factory.createTypeReferenceNode("never")],
                        []
                      )
                    )
                  )], ts.NodeFlags.Const)
                ),
                {
                  prefix: "\n",
                  suffix: "\n"
                }
              )
            }
            changeTracker.deleteRange(sourceFile, {
              pos: ts.getTokenPosOfNode(node.expression, sourceFile),
              end: node.arguments[0].pos
            })
            changeTracker.insertText(
              sourceFile,
              node.arguments[0].pos,
              supportedEffect === "v4"
                ? `${effectModuleIdentifier}.${isEffectRunCall.value.methodName}With(${
                  servicesIdentifier || "effectServices"
                })(`
                : `${runtimeModuleIdentifier}.${isEffectRunCall.value.methodName}(${
                  runtimeIdentifier || "effectRuntime"
                }, `
            )
          })

          const v4MethodName = `${isEffectRunCall.value.methodName}With`
          const messageText = supportedEffect === "v4"
            ? `\`${nodeText}\` is called inside an Effect with a separate services invocation. In this context, child Effects run with the surrounding services, which can be accessed through \`Effect.services\` and \`Effect.${v4MethodName}\`.`
            : `\`${nodeText}\` is called inside an Effect with a separate runtime invocation. In this context, run child Effects with the surrounding runtime, which can be accessed through \`Effect.runtime\` and \`Runtime.${isEffectRunCall.value.methodName}\`.`

          report({
            location: node.expression,
            messageText,
            fixes: [{
              fixName: "runEffectInsideEffect_fix",
              description: supportedEffect === "v4"
                ? "Use the current services to run the Effect"
                : "Use a runtime to run the Effect",
              apply: fixAddRuntime
            }]
          })
        } else {
          report({
            location: node.expression,
            messageText:
              `\`${nodeText}\` is called inside an existing Effect context. Here, the inner Effect can be used directly.`,
            fixes: []
          })
        }
      }
    }
  })
})
