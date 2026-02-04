import { pipe } from "effect"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectSqlModelSelfInClasses = LSP.createCompletion({
  name: "effectSqlModelSelfInClasses",
  apply: Nano.fn("effectSqlModelSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    if (typeParser.supportedEffect() === "v4") return []

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const schemaIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "@effect/sql",
      "Model"
    ) || "Model"

    // Check if this is a fully qualified name (e.g., Schema.Class)
    const isFullyQualified = schemaIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // Check for Model.Class or direct import Class
    const hasClassCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectSqlModelModuleApi("Class")(accessedObject),
        Nano.option
      )
    )
    if (hasClassCompletion) {
      completions.push({
        name: `Class<${name}>`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${schemaIdentifier}.Class<${name}>("${name}")({${"${0}"}}){}`
          : `Class<${name}>("${name}")({${"${0}"}}){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    return completions
  })
})
