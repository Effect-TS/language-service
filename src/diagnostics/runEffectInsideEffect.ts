import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const runEffectInsideEffect = LSP.createDiagnostic({
  name: "runEffectInsideEffect",
  code: 32,
  severity: "suggestion",
  apply: Nano.fn("runEffectInsideEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
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

      // Check if this is a call expression
      if (!ts.isCallExpression(node)) continue

      // Verify it's actually an Effect module call using TypeParser
      const isEffectRunCall = yield* pipe(
        typeParser.isNodeReferenceToEffectModuleApi("runPromise")(node.expression),
        Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("runSync")(node.expression)),
        Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("runFork")(node.expression)),
        Nano.orElse(() => typeParser.isNodeReferenceToEffectModuleApi("runCallback")(node.expression)),
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

        if (Option.isSome(isInEffectGen)) {
          const nodeText = sourceFile.text.substring(
            ts.getTokenPosOfNode(node.expression, sourceFile),
            node.expression.end
          )

          console.log(nodeIntroduceScope, isInEffectGen.value.generatorFunction)
          const messageText = nodeIntroduceScope && nodeIntroduceScope !== isInEffectGen.value.generatorFunction ?
            `Using ${nodeText} inside an Effect is not recommended. The same runtime should generally be used instead to run child effects.\nConsider extracting the Runtime by using for example Effect.runtime and then use Runtime.run* with the extracted runtime instead.` :
            `Using ${nodeText} inside an Effect is not recommended. Effects inside generators can usually just be yielded.`

          report({
            location: node.expression,
            messageText,
            fixes: []
          })
        }

        // Continue traversing up the parent chain
        currentParent = currentParent.parent
      }
    }
  })
})
