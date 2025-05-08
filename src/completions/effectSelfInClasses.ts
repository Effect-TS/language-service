import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const effectSelfInClasses = LSP.createCompletion({
  name: "effect/effectSelfInClasses",
  apply: Nano.fn("effectSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* AST.parseDataForExtendsClassCompletion(sourceFile, position)
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject, className, replacementSpan } = maybeInfos.value

    // first, given the position, we go back
    const effectName = yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Effect"
      )
    )
    const effectIdentifier = Option.match(effectName, {
      onNone: () => "Effect",
      onSome: (_) => _.text
    })

    // ensure accessed is an identifier
    if (effectIdentifier !== accessedObject.text) return []
    const name = className.text

    return [{
      name: `Service<${name}>`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `${effectIdentifier}.Service<${name}>()("${name}", {${"${0}"}}){}`,
      replacementSpan,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
