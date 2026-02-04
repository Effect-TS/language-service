import { pipe } from "effect"
import * as Option from "effect/Option"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectSelfInClasses = LSP.createCompletion({
  name: "effectSelfInClasses",
  apply: Nano.fn("effectSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const effectIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    // Check if this is a fully qualified name (e.g., Effect.Service)
    const isFullyQualified = effectIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // create the expected identifier
    const tagKey = (yield* KeyBuilder.createString(sourceFile, name, "service")) || name

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // If extending Service (either Effect.Service or direct import Service)
    if (typeParser.supportedEffect() === "v3") {
      const hasServiceCompletion = isFullyQualified || Option.isSome(
        yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("Service")(accessedObject),
          Nano.option
        )
      )
      if (hasServiceCompletion) {
        completions.push({
          name: `Service<${name}>`,
          kind: ts.ScriptElementKind.constElement,
          insertText: isFullyQualified
            ? `${effectIdentifier}.Service<${name}>()("${tagKey}", {${"${0}"}}){}`
            : `Service<${name}>()("${tagKey}", {${"${0}"}}){}`,
          replacementSpan,
          isSnippet: true
        })
      }
    }

    // If extending Tag (either Effect.Tag or direct import Tag)
    if (typeParser.supportedEffect() === "v3") {
      const hasTagCompletion = isFullyQualified || Option.isSome(
        yield* pipe(
          typeParser.isNodeReferenceToEffectModuleApi("Tag")(accessedObject),
          Nano.option
        )
      )
      if (hasTagCompletion) {
        completions.push({
          name: `Tag("${name}")`,
          kind: ts.ScriptElementKind.constElement,
          insertText: isFullyQualified
            ? `${effectIdentifier}.Tag("${tagKey}")<${name}, {${"${0}"}}>(){}`
            : `Tag("${tagKey}")<${name}, {${"${0}"}}>(){}`,
          replacementSpan,
          isSnippet: true
        })
      }
    }

    return completions
  })
})
