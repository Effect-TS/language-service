import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const contextSelfInClasses = LSP.createCompletion({
  name: "effect/contextSelfInClasses",
  apply: Nano.fn("contextSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* Nano.option(
      AST.parseDataForExtendsClassCompletion(sourceFile, position)
    )
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject, className, replacementSpan } = maybeInfos.value

    // first, given the position, we go back
    const contextName = yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Context"
      )
    )
    const contextIdentifier = Option.match(contextName, {
      onNone: () => "Context",
      onSome: (_) => _.text
    })

    // ensure accessed is an identifier
    if (contextIdentifier !== accessedObject.text) return []
    const name = className.text

    return [{
      name: `Tag("${name}")`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${contextIdentifier}.Tag("${name}")<${name}, ${"${0}"}>(){}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
