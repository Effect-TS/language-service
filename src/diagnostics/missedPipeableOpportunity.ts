import { pipe } from "effect/Function"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const missedPipeableOpportunity = LSP.createDiagnostic({
  name: "missedPipeableOpportunity",
  code: 26,
  description: "Enforces the use of pipeable style for nested function calls",
  severity: "off",
  apply: Nano.fn("missedPipeableOpportunity.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    // Get all piping flows for the source file
    const flows = yield* typeParser.pipingFlows(sourceFile)

    for (const flow of flows) {
      // Skip flows with too few transformations
      if (flow.transformations.length < options.pipeableMinArgCount) {
        continue
      }

      // Skip if we produce a callable function in the end
      const finalType = flow.transformations[flow.transformations.length - 1].outType
      if (!finalType) {
        continue
      }
      const callSigs = typeChecker.getSignaturesOfType(finalType, ts.SignatureKind.Call)
      if (callSigs.length > 0) {
        continue
      }

      // Find the first pipeable type in the flow
      // Start with subject, then check each transformation's outType
      let firstPipeableIndex = -1

      // Check if subject is pipeable
      const subjectType = flow.subject.outType
      if (!subjectType) {
        continue
      }
      const subjectIsPipeable = yield* pipe(
        typeParser.pipeableType(subjectType, flow.subject.node),
        Nano.option
      )

      if (subjectIsPipeable._tag === "Some") {
        firstPipeableIndex = 0
      } else {
        // Check transformations for first pipeable outType
        for (let i = 0; i < flow.transformations.length; i++) {
          const t = flow.transformations[i]
          if (t.outType) {
            const isPipeable = yield* pipe(
              typeParser.pipeableType(t.outType, flow.node),
              Nano.option
            )
            if (isPipeable._tag === "Some") {
              firstPipeableIndex = i + 1 // +1 because subject is index 0
              break
            }
          }
        }
      }

      // If no pipeable type found, skip this flow
      if (firstPipeableIndex === -1) {
        continue
      }

      // Count "call" kind transformations after the first pipeable
      const transformationsAfterPipeable = flow.transformations.slice(firstPipeableIndex)
      const callKindCount = transformationsAfterPipeable.filter((t) => t.kind === "call").length

      // If not enough call-kind transformations, skip
      if (callKindCount < options.pipeableMinArgCount) {
        continue
      }

      // Get the subject for the pipeable part
      // If firstPipeableIndex === 0, the subject is flow.subject.node
      // Otherwise, we need to reconstruct the expression up to the pipeable point
      const pipeableSubjectNode = firstPipeableIndex === 0
        ? flow.subject.node
        : typeParser.reconstructPipingFlow({
          subject: flow.subject,
          transformations: flow.transformations.slice(0, firstPipeableIndex)
        })

      // Get transformations to convert to .pipe() style
      const pipeableTransformations = flow.transformations.slice(firstPipeableIndex)

      report({
        location: flow.node,
        messageText: `Nested function calls can be converted to pipeable style for better readability.`,
        fixes: [{
          fixName: "missedPipeableOpportunity_fix",
          description: "Convert to pipe style",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

            // Build the pipe arguments from transformations
            const pipeArgs = pipeableTransformations.map((t) => {
              if (t.args) {
                // It's a function call like Effect.map((x) => x + 1)
                return ts.factory.createCallExpression(
                  t.callee,
                  undefined,
                  t.args
                )
              } else {
                // It's a constant like Effect.asVoid
                return t.callee
              }
            })

            // Create the new pipe call: subject.pipe(...)
            const newNode = ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                pipeableSubjectNode,
                "pipe"
              ),
              undefined,
              pipeArgs
            )

            changeTracker.replaceNode(sourceFile, flow.node, newNode)
          })
        }]
      })
    }
  })
})
