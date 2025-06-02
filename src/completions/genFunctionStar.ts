import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const genFunctionStar = LSP.createCompletion({
  name: "genFunctionStar",
  apply: Nano.fn("genFunctionStar")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const maybeInfos = yield* Nano.option(
      AST.parseAccessedExpressionForCompletion(sourceFile, position)
    )
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject } = maybeInfos.value

    const type = typeChecker.getTypeAtLocation(accessedObject)
    const genMemberSymbol = type.getProperty("gen")
    if (!genMemberSymbol) return []
    const genType = typeChecker.getTypeOfSymbolAtLocation(genMemberSymbol, accessedObject)
    if (genType.getCallSignatures().length === 0) return []

    const span = ts.createTextSpan(
      accessedObject.end + 1,
      Math.max(0, position - accessedObject.end - 1)
    )

    return [{
      name: `gen(function*(){})`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `gen(function*(){${"${0}"}})`,
      replacementSpan: span,
      isSnippet: true
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
