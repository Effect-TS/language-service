import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const strictEffectProvide = LSP.createDiagnostic({
  name: "strictEffectProvide",
  code: 27,
  description: "Warns when using Effect.provide with layers outside of application entry points",
  severity: "off",
  apply: Nano.fn("strictEffectProvide.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const parseEffectProvideWithLayer = (node: ts.Node) =>
      Nano.gen(function*() {
        // Check if this is a call expression: Effect.provide(...)
        if (
          !ts.isCallExpression(node) ||
          node.arguments.length === 0
        ) {
          return yield* TypeParser.typeParserIssue("Not an Effect.provide call")
        }

        // Check if the expression is from the Effect module
        yield* typeParser.isNodeReferenceToEffectModuleApi("provide")(node.expression)

        // Check if any argument is a Layer using firstSuccessOf
        return yield* Nano.firstSuccessOf(
          node.arguments.map((arg) => {
            const argType = typeCheckerUtils.getTypeAtLocation(arg)
            if (!argType) return TypeParser.typeParserIssue("Could not get argument type")
            return typeParser.layerType(argType, arg)
          })
        )
      })

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (ts.isCallExpression(node)) {
        const layerCheck = yield* pipe(parseEffectProvideWithLayer(node), Nano.option)
        if (Option.isSome(layerCheck)) {
          report({
            location: node,
            messageText:
              "Effect.provide with a Layer should only be used at application entry points. If this is an entry point, you can safely disable this diagnostic. Otherwise, using Effect.provide may break scope lifetimes. Compose all layers at your entry point and provide them at once.",
            fixes: []
          })
        }
      }
    }
  })
})
