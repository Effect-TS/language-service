import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const effectSelfInClasses = LSP.createCompletion({
  name: "effectSelfInClasses",
  apply: Nano.fn("effectSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const effectIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Effect"
    ) || "Effect"

    // ensure accessed is an identifier
    if (effectIdentifier !== ts.idText(accessedObject)) return []
    const name = ts.idText(className)

    return [{
      name: `Service<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${effectIdentifier}.Service<${name}>()("${name}", {${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
