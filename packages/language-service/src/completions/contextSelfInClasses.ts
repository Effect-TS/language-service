import { pipe } from "effect"
import * as Option from "effect/Option"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const contextSelfInClasses = LSP.createCompletion({
  name: "contextSelfInClasses",
  apply: Nano.fn("contextSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const contextIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Context"
    ) || "Context"

    // Check if this is a fully qualified name (e.g., Context.Tag)
    const isFullyQualified = contextIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // create the expected identifier
    const tagKey = (yield* KeyBuilder.createString(sourceFile, name, "service")) || name

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // Check for Context.Tag or direct import Tag
    const hasTagCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectContextModuleApi("Tag")(accessedObject),
        Nano.option
      )
    )
    if (hasTagCompletion) {
      completions.push({
        name: `Tag("${name}")`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${contextIdentifier}.Tag("${tagKey}")<${name}, ${"${0}"}>(){}`
          : `Tag("${tagKey}")<${name}, ${"${0}"}>(){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    return completions
  })
})
