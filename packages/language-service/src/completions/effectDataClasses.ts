import { pipe } from "effect"
import * as Option from "effect/Option"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectDataClasses = LSP.createCompletion({
  name: "effectDataClasses",
  apply: Nano.fn("effectDataClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const effectDataIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Data"
    ) || "Data"

    // Check if this is a fully qualified name (e.g., Data.TaggedError)
    const isFullyQualified = effectDataIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // create the expected identifier
    const errorTagKey = (yield* KeyBuilder.createString(sourceFile, name, "error")) || name

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // Check for Data.TaggedError or direct import TaggedError
    const hasTaggedErrorCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectDataModuleApi("TaggedError")(accessedObject),
        Nano.option
      )
    )
    if (hasTaggedErrorCompletion) {
      completions.push({
        name: `TaggedError("${name}")`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${effectDataIdentifier}.TaggedError("${errorTagKey}")<{${"${0}"}}>{}`
          : `TaggedError("${errorTagKey}")<{${"${0}"}}>{}`,
        replacementSpan,
        isSnippet: true
      })
    }

    // Check for Data.TaggedClass or direct import TaggedClass
    const hasTaggedClassCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectDataModuleApi("TaggedClass")(accessedObject),
        Nano.option
      )
    )
    if (hasTaggedClassCompletion) {
      completions.push({
        name: `TaggedClass("${name}")`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${effectDataIdentifier}.TaggedClass("${name}")<{${"${0}"}}>{}`
          : `TaggedClass("${name}")<{${"${0}"}}>{}`,
        replacementSpan,
        isSnippet: true
      })
    }

    return completions
  })
})
