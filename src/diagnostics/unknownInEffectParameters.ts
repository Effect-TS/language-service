import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unknownInEffectParameters = LSP.createDiagnostic({
  name: "unknownInEffectParameters",
  code: 22,
  severity: "warning",
  apply: Nano.fn("unknownInEffectParameters.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const nodesToReport: Set<[ts.Node, string]> = new Set()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      const skipThisAndChildren = node.kind === ts.SyntaxKind.TypeParameter || ts.isParameter(node) ||
        ts.isAsExpression(node) || ts.isPartOfTypeNode(node)
      if (
        !skipThisAndChildren
      ) {
        ts.forEachChild(node, appendNodeToVisit)
      }

      if (skipThisAndChildren) continue
      if (!ts.isExpression(node)) continue

      const type = typeChecker.getTypeAtLocation(node)

      yield* pipe(
        typeParser.effectType(
          type,
          node
        ),
        Nano.map((effectTypes) => {
          let message: string | undefined
          if (effectTypes.R.flags & ts.TypeFlags.Unknown) {
            message = `Effect Context is inferred as unknown here.`
          } else if (effectTypes.R.flags & ts.TypeFlags.Any) {
            message = `Effect Context is inferred as any here.`
          }
          const contextual = typeChecker.getContextualType(node)
          if (message && contextual) message += ` Contextual type: ${typeChecker.typeToString(contextual)}`
          if (message) {
            const outerNode = pipe(
              Array.fromIterable(nodesToReport),
              Array.findFirst(([_]) => _.pos <= node.pos && _.end >= node.end)
            )
            if (Option.isSome(outerNode)) {
              nodesToReport.delete(outerNode.value)
            }
            nodesToReport.add([node, message])
          }
        }),
        Nano.ignore
      )
    }

    for (const [node, message] of nodesToReport) {
      report(
        {
          location: node,
          messageText: message,
          fixes: []
        }
      )
    }
  })
})
