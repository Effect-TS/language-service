import { pipe } from "effect"
import * as Option from "effect/Option"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectSchemaSelfInClasses = LSP.createCompletion({
  name: "effectSchemaSelfInClasses",
  apply: Nano.fn("effectSchemaSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const schemaIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Schema"
    ) || "Schema"

    // Check if this is a fully qualified name (e.g., Schema.Class)
    const isFullyQualified = schemaIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // create the expected identifier
    const errorTagKey = (yield* KeyBuilder.createString(sourceFile, name, "error")) || name

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // Check for Schema.Class or direct import Class
    const hasClassCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectSchemaModuleApi("Class")(accessedObject),
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

    // Check for Schema.TaggedError or direct import TaggedError
    const hasTaggedErrorCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectSchemaModuleApi("TaggedError")(accessedObject),
        Nano.option
      )
    )
    if (hasTaggedErrorCompletion) {
      completions.push({
        name: `TaggedError<${name}>`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${schemaIdentifier}.TaggedError<${name}>()("${errorTagKey}", {${"${0}"}}){}`
          : `TaggedError<${name}>()("${errorTagKey}", {${"${0}"}}){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    // Check for Schema.TaggedClass or direct import TaggedClass
    const hasTaggedClassCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectSchemaModuleApi("TaggedClass")(accessedObject),
        Nano.option
      )
    )
    if (hasTaggedClassCompletion) {
      completions.push({
        name: `TaggedClass<${name}>`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${schemaIdentifier}.TaggedClass<${name}>()("${name}", {${"${0}"}}){}`
          : `TaggedClass<${name}>()("${name}", {${"${0}"}}){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    // Check for Schema.TaggedRequest or direct import TaggedRequest
    const hasTaggedRequestCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToEffectSchemaModuleApi("TaggedRequest")(accessedObject),
        Nano.option
      )
    )
    if (hasTaggedRequestCompletion) {
      completions.push({
        name: `TaggedRequest<${name}>`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${schemaIdentifier}.TaggedRequest<${name}>()("${name}", {${"${0}"}}){}`
          : `TaggedRequest<${name}>()("${name}", {${"${0}"}}){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    return completions
  })
})
