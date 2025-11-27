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
  severity: "suggestion",
  apply: Nano.fn("runEffectInsideEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

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

      // Traverse up the parent chain to check if we're inside an Effect context
      let currentParent: ts.Node | undefined = node.parent
      let nodeIntroduceScope: ts.Node | undefined = undefined

      while (currentParent) {
        // Try to parse the current parent node as Effect.gen, Effect.fn, or Effect.fnUntraced
        const possiblyEffectGen = currentParent // capture for type narrowing

        if (!nodeIntroduceScope) {
          if (
            ts.isFunctionExpression(possiblyEffectGen) || ts.isFunctionDeclaration(possiblyEffectGen) ||
            ts.isMethodDeclaration(possiblyEffectGen) || ts.isArrowFunction(possiblyEffectGen)
          ) {
            nodeIntroduceScope = possiblyEffectGen
            continue
          }
        }

        const isInEffectGen = yield* pipe(
          typeParser.effectGen(possiblyEffectGen),
          Nano.orElse(() => typeParser.effectFnUntracedGen(possiblyEffectGen)),
          Nano.orElse(() => typeParser.effectFnGen(possiblyEffectGen)),
          Nano.option
        )

        if (Option.isSome(isInEffectGen) && isInEffectGen.value.body.statements.length > 0) {
          const nodeText = sourceFile.text.substring(
            ts.getTokenPosOfNode(node.expression, sourceFile),
            node.expression.end
          )

          if (nodeIntroduceScope && nodeIntroduceScope !== isInEffectGen.value.generatorFunction) {
            const fixAddRuntime = Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
              const runtimeModuleIdentifier =
                tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Runtime") ||
                "Runtime"
              const effectModuleIdentifier =
                tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(sourceFile, "effect", "Effect") || "Effect"
              let runtimeIdentifier: string | undefined = undefined
              for (const statement of isInEffectGen.value.generatorFunction.body.statements) {
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
                    }
                  }
                }
              }
              if (!runtimeIdentifier) {
                changeTracker.insertNodeAt(
                  sourceFile,
                  isInEffectGen.value.body.statements[0].pos,
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
                `${runtimeModuleIdentifier}.${isEffectRunCall.value.methodName}(${
                  runtimeIdentifier || "effectRuntime"
                }, `
              )
            })

            report({
              location: node.expression,
              messageText:
                `Using ${nodeText} inside an Effect is not recommended. The same runtime should generally be used instead to run child effects.\nConsider extracting the Runtime by using for example Effect.runtime and then use Runtime.${isEffectRunCall.value.methodName} with the extracted runtime instead.`,
              fixes: [{
                fixName: "runEffectInsideEffect_fix",
                description: "Use a runtime to run the Effect",
                apply: fixAddRuntime
              }]
            })
          } else {
            report({
              location: node.expression,
              messageText:
                `Using ${nodeText} inside an Effect is not recommended. Effects inside generators can usually just be yielded.`,
              fixes: []
            })
          }
        }

        // Continue traversing up the parent chain
        currentParent = currentParent.parent
      }
    }
  })
})
