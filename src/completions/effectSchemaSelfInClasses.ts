import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const effectSchemaSelfInClasses = LSP.createCompletion({
  name: "effect/effectSchemaSelfInClasses",
  apply: Nano.fn("effectSchemaSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* AST.parseDataForExtendsClassCompletion(sourceFile, position)
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject, className, replacementSpan } = maybeInfos.value

    // first, given the position, we go back
    const effectSchemaName = yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Schema"
      )
    )
    const schemaIdentifier = Option.match(effectSchemaName, {
      onNone: () => "Schema",
      onSome: (_) => _.text
    })

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
