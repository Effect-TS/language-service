import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const effectDoNotation = LSP.createDiagnostic({
  name: "effectDoNotation",
  code: 73,
  description: "Suggests using Effect.gen or Effect.fn instead of the Effect.Do notation helpers",
  group: "style",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("effectDoNotation.apply")(function*(sourceFile, report) {
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

      const isReference = yield* Nano.orUndefined(typeParser.isNodeReferenceToEffectModuleApi("Do")(node))
      if (isReference) {
        report({
          location: node,
          messageText:
            "This uses the Effect do emulation. `Effect.gen` or `Effect.fn` achieve the same result with native JS scopes.",
          fixes: []
        })
        continue
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
