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
    if (effectDataIdentifier !== accessedObject.text) return []
    const name = className.text

    return [{
      name: `TaggedError("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${effectDataIdentifier}.TaggedError("${name}")<{${"${0}"}}>{}`,
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
