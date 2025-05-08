import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const effectDataClasses = LSP.createCompletion({
  name: "effect/effectDataClasses",
  apply: Nano.fn("effectDataClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* AST.parseDataForExtendsClassCompletion(sourceFile, position)
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject, className, replacementSpan } = maybeInfos.value

    // first, given the position, we go back
    const dataName = yield* Nano.option(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Data"
      )
    )
    const effectDataIdentifier = Option.match(dataName, {
      onNone: () => "Data",
      onSome: (_) => _.text
    })

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
