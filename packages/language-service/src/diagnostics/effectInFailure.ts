import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const effectInFailure = LSP.createDiagnostic({
  name: "effectInFailure",
  code: 49,
  description: "Warns when an Effect is used inside an Effect failure channel",
  group: "antipattern",
  severity: "warning",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("effectInFailure.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const isStrictEffectType = Nano.cachedBy(
      Nano.fn("effectInFailure.isStrictEffectType")(function*(type: ts.Type, atLocation: ts.Node) {
        yield* typeParser.strictEffectType(type, atLocation)
        return true
      }),
      "effectInFailure.isStrictEffectType",
      (type) => type
    )

    const visited = new WeakSet<ts.Node>()
    const stack: Array<ts.Node> = [sourceFile]
    const shouldSkipBecauseChildMatched = new WeakSet<ts.Node>()

    while (stack.length > 0) {
      const node = stack.pop()!

      // visit children first
      if (!visited.has(node)) {
        visited.add(node)
        stack.push(node)
        ts.forEachChild(node, (child) => {
          stack.push(child)
          return undefined
        })
        continue
      }

      // check if any child has already matched
      if (shouldSkipBecauseChildMatched.has(node)) {
        if (node.parent) shouldSkipBecauseChildMatched.add(node.parent)
        continue
      }

      const type = typeCheckerUtils.getTypeAtLocation(node)
      if (!type) continue

      const effect = yield* Nano.orUndefined(typeParser.strictEffectType(type, node))
      if (!effect) continue

      const failureMembers = typeCheckerUtils.unrollUnionMembers(effect.E)
      let memberWithEffect: ts.Type | undefined = undefined
      for (const member of failureMembers) {
        const isMemberEffect = yield* Nano.orUndefined(isStrictEffectType(member, node))
        if (isMemberEffect) {
          memberWithEffect = member
          break
        }
      }
      if (!memberWithEffect) continue

      const messageText = `The error channel contains an Effect (${typeChecker.typeToString(memberWithEffect)}). ` +
        `Putting Effect computations in the failure channel is not intended; keep only failure types there.`

      report({
        location: node,
        messageText,
        fixes: []
      })
      if (node.parent) {
        shouldSkipBecauseChildMatched.add(node.parent)
      }
    }
  })
})
