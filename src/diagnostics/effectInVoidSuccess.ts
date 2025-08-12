import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const effectInVoidSuccess = LSP.createDiagnostic({
  name: "effectInVoidSuccess",
  code: 14,
  severity: "warning",
  apply: Nano.fn("effectInVoidSuccess.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const checkForEffectInVoid = Nano.fn("effectInVoidSuccess.checkForEffectInVoid")(function*(
      node: ts.Node,
      expectedType: ts.Type,
      valueNode: ts.Node,
      realType: ts.Type
    ) {
      const expectedEffect = yield* typeParser.effectType(expectedType, node)
      const realEffect = yield* typeParser.effectType(realType, valueNode)
      if (expectedEffect.A.flags & ts.TypeFlags.Void) {
        const voidValueTypes = typeCheckerUtils.unrollUnionMembers(realEffect.A)
        const voidedEffect = yield* Nano.firstSuccessOf(
          voidValueTypes.map((_) => Nano.map(typeParser.strictEffectType(_, node), () => _))
        )
        return { voidedEffect }
      }
      return yield* Nano.fail(TypeParser.typeParserIssue("expectedEffect success is not void"))
    })

    const entries = yield* TypeCheckerApi.expectedAndRealType(sourceFile)
    for (const [node, expectedType, valueNode, realType] of entries) {
      if (expectedType !== realType) {
        yield* pipe(
          checkForEffectInVoid(
            node,
            expectedType,
            valueNode,
            realType
          ),
          Nano.map(({ voidedEffect }) => {
            report(
              {
                location: node,
                messageText: `There is a nested '${
                  typeChecker.typeToString(voidedEffect)
                }' in the 'void' success channel, beware that this could lead to nested Effect<Effect<...>> that won't be executed.`,
                fixes: []
              }
            )
          }),
          Nano.ignore
        )
      }
    }
  })
})
