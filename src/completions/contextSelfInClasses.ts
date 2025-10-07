import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const contextSelfInClasses = LSP.createCompletion({
  name: "contextSelfInClasses",
  apply: Nano.fn("contextSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const contextIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Context"
    ) || "Context"

    // ensure accessed is an identifier
    if (contextIdentifier !== ts.idText(accessedObject)) return []
    const name = ts.idText(className)

    // create the expected identifier
    const tagKey = (yield* KeyBuilder.createString(sourceFile, name, "service")) || name

    return [{
      name: `Tag("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${contextIdentifier}.Tag("${tagKey}")<${name}, ${"${0}"}>(){}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
