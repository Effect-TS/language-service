import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const rpcMakeClasses = LSP.createCompletion({
  name: "rpcMakeClasses",
  apply: Nano.fn("rpcMakeClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* Nano.option(
      AST.parseDataForExtendsClassCompletion(sourceFile, position)
    )
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject, className, replacementSpan } = maybeInfos.value

    // first, given the position, we go back
    const rpcName = yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "@effect/rpc",
        "Rpc"
      )
    )
    const rpcIdentifier = Option.match(rpcName, {
      onNone: () => "Rpc",
      onSome: (_) => _.text
    })

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
