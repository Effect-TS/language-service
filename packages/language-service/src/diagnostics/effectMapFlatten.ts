import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"

export const effectMapFlatten = LSP.createDiagnostic({
  name: "effectMapFlatten",
  code: 74,
  description: "Suggests using Effect.flatMap instead of Effect.map followed by Effect.flatten in piping flows",
  group: "style",
  severity: "suggestion",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("effectMapFlatten.apply")(function*(sourceFile, report) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const flows = yield* typeParser.pipingFlows(false)(sourceFile)

    for (const flow of flows) {
      for (let index = 0; index < flow.transformations.length - 1; index++) {
        const mapTransformation = flow.transformations[index]
        const flattenTransformation = flow.transformations[index + 1]

        if (
          !mapTransformation || !flattenTransformation ||
          !mapTransformation?.args ||
          flattenTransformation?.args ||
          (mapTransformation.kind !== "pipe" && mapTransformation.kind !== "pipeable") ||
          flattenTransformation.kind !== mapTransformation.kind
        ) {
          continue
        }

        const isMapCall = yield* Nano.orUndefined(
          typeParser.isNodeReferenceToEffectModuleApi("map")(mapTransformation.callee)
        )

        const isFlattenCall = yield* Nano.orUndefined(
          typeParser.isNodeReferenceToEffectModuleApi("flatten")(flattenTransformation.callee)
        )

        if (isMapCall && isFlattenCall) {
          report({
            location: flattenTransformation.callee,
            messageText:
              "`Effect.map` + `Effect.flatten` is the same as `Effect.flatMap` that expresses the same steps more directly.",
            fixes: []
          })
        }
      }
    }
  })
})
