import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const genFunctionStar = LSP.createCompletion({
  name: "genFunctionStar",
  apply: Nano.fn("genFunctionStar")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const maybeInfos = tsUtils.parseAccessedExpressionForCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject } = maybeInfos

    const type = typeCheckerUtils.getTypeAtLocation(accessedObject)
    if (!type) return []
    const genMemberSymbol = type.getProperty("gen")
    if (!genMemberSymbol) return []
    const genType = typeChecker.getTypeOfSymbolAtLocation(genMemberSymbol, accessedObject)
    if (typeChecker.getSignaturesOfType(genType, ts.SignatureKind.Call).length === 0) return []

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
