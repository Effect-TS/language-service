import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const catchUnfailableEffect = LSP.createDiagnostic({
  name: "catchUnfailableEffect",
  code: 2,
  description: "Warns when using error handling on Effects that never fail (error type is 'never')",
  severity: "suggestion",
  apply: Nano.fn("catchUnfailableEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const catchFunctions = ["catchAll", "catch", "catchIf", "catchSome", "catchTag", "catchTags"]

    // Get all piping flows for the source file (including Effect.fn pipe transformations)
    const flows = yield* typeParser.pipingFlows(true)(sourceFile)

    for (const flow of flows) {
      // Look for catch transformations in the flow
      for (let i = 0; i < flow.transformations.length; i++) {
        const transformation = flow.transformations[i]

        // Skip if no args (constants like Effect.asVoid)
        if (!transformation.args || transformation.args.length === 0) {
          continue
        }

        // Check if the callee is one of the catch functions
        const isCatchCall = yield* pipe(
          Nano.firstSuccessOf(
            catchFunctions.map((catchFn) => typeParser.isNodeReferenceToEffectModuleApi(catchFn)(transformation.callee))
          ),
          Nano.option
        )

        if (Option.isNone(isCatchCall)) {
          continue
        }

        // Get the input type for this transformation
        // If this is the first transformation, use the subject's type
        // Otherwise, use the previous transformation's output type
        const inputType: ts.Type | undefined = i === 0
          ? flow.subject.outType
          : flow.transformations[i - 1].outType

        if (!inputType) {
          continue
        }

        // Check if the input effect type has error type never
        const effectType = yield* pipe(
          typeParser.effectType(inputType, transformation.callee),
          Nano.option
        )

        // Only report if we successfully parsed an effect type and E is never
        if (Option.isSome(effectType)) {
          const { E } = effectType.value

          // Only report if E is exactly never
          if (E.flags & ts.TypeFlags.Never) {
            report({
              location: transformation.callee,
              messageText:
                `Looks like the previous effect never fails, so probably this error handling will never be triggered.`,
              fixes: []
            })
          }
        }
      }
    }
  })
})
