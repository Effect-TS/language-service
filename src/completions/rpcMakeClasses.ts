import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const rpcMakeClasses = LSP.createCompletion({
  name: "rpcMakeClasses",
  apply: Nano.fn("rpcMakeClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const rpcIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "@effect/rpc",
      "Rpc"
    ) || "Rpc"

    // ensure accessed is an identifier
    if (rpcIdentifier !== accessedObject.text) return []
    const name = className.text

    return [{
      name: `make("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${rpcIdentifier}.make("${name}", {${"${0}"}}) {}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
