import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectSchemaSelfInClasses = LSP.createCompletion({
  name: "effectSchemaSelfInClasses",
  apply: Nano.fn("effectSchemaSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const schemaIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Schema"
    ) || "Schema"

    // ensure accessed is an identifier
    if (schemaIdentifier !== accessedObject.text) return []
    const name = className.text

    return [{
      name: `Class<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${schemaIdentifier}.Class<${name}>("${name}")({${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }, {
      name: `TaggedError<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${schemaIdentifier}.TaggedError<${name}>("${name}")("${name}", {${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }, {
      name: `TaggedClass<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${schemaIdentifier}.TaggedClass<${name}>("${name}")("${name}", {${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }, {
      name: `TaggedRequest<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${schemaIdentifier}.TaggedRequest<${name}>("${name}")("${name}", {${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
