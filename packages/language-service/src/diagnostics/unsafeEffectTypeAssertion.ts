import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unsafeEffectTypeAssertion = LSP.createDiagnostic({
  name: "unsafeEffectTypeAssertion",
  code: 75,
  description: "Detects unsafe type assertions that narrow Effect error or requirements channels",
  group: "effectNative",
  severity: "off",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("unsafeEffectTypeAssertion.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const isAnyType = (type: ts.Type | undefined) => !!type && (type.flags & ts.TypeFlags.Any) !== 0

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) continue

      const originalType = typeCheckerUtils.getTypeAtLocation(node.expression)
      const assertedType = typeCheckerUtils.getTypeAtLocation(node)
      if (!originalType || !assertedType) continue

      const originalEffect = yield* pipe(typeParser.effectType(originalType, node.expression), Nano.orUndefined)
      if (!originalEffect) continue

      const assertedEffect = yield* pipe(typeParser.effectType(assertedType, node), Nano.orUndefined)
      if (!assertedEffect) continue

      const invalidChannels: Array<{ name: string; original: ts.Type; asserted: ts.Type }> = []

      if (
        originalEffect.E && assertedEffect.E && !isAnyType(originalEffect.E) &&
        !typeChecker.isTypeAssignableTo(originalEffect.E, assertedEffect.E)
      ) {
        invalidChannels.push({ name: "error", original: originalEffect.E, asserted: assertedEffect.E })
      }

      if (
        originalEffect.R && assertedEffect.R && !isAnyType(originalEffect.R) &&
        !typeChecker.isTypeAssignableTo(originalEffect.R, assertedEffect.R)
      ) {
        invalidChannels.push({ name: "requirements", original: originalEffect.R, asserted: assertedEffect.R })
      }

      if (invalidChannels.length === 0) continue

      const details = invalidChannels
        .map(({ asserted, name, original }) =>
          `The ${name} channel is narrowed from \`${typeChecker.typeToString(original)}\` to \`${
            typeChecker.typeToString(asserted)
          }\`.`
        )
        .join("\n")

      report({
        location: node,
        messageText: "This type assertion unsafely narrows the Effect error or requirements channels.\n" + details,
        fixes: [{
          fixName: "unsafeEffectTypeAssertion_fix",
          description: "Remove the unsafe Effect assertion",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            changeTracker.replaceNode(sourceFile, node, node.expression)
          })
        }]
      })
    }
  })
})
