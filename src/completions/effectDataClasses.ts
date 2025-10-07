import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectDataClasses = LSP.createCompletion({
  name: "effectDataClasses",
  apply: Nano.fn("effectDataClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const effectDataIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Data"
    ) || "Data"

    // ensure accessed is an identifier
    if (effectDataIdentifier !== ts.idText(accessedObject)) return []
    const name = ts.idText(className)

    // create the expected identifier
    const errorTagKey = (yield* KeyBuilder.createString(sourceFile, name, "error")) || name

    return [{
      name: `TaggedError("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${effectDataIdentifier}.TaggedError("${errorTagKey}")<{${"${0}"}}>{}`,
      replacementSpan,
      isSnippet: true
    }, {
      name: `TaggedClass("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${effectDataIdentifier}.TaggedClass("${name}")<{${"${0}"}}>{}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
