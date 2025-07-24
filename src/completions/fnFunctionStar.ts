import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const fnFunctionStar = LSP.createCompletion({
  name: "fnFunctionStar",
  apply: Nano.fn("fnFunctionStar")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const maybeInfos = tsUtils.parseAccessedExpressionForCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject } = maybeInfos

    // we check if it is an effect
    const isEffectModule = yield* Nano.option(typeParser.importedEffectModule(accessedObject))
    if (Option.isNone(isEffectModule)) return []

    const span = ts.createTextSpan(
      accessedObject.end + 1,
      Math.max(0, position - accessedObject.end - 1)
    )

    const maybeFnName: Array<LSP.CompletionEntryDefinition> = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, tsUtils.toTextRange(accessedObject.pos)),
      Array.filter(ts.isVariableDeclaration),
      Array.map((_) => _.name && ts.isIdentifier(_.name) ? _.name.text : ""),
      Array.filter((_) => _.length > 0),
      Array.head,
      Option.map((name) => [
        {
          name: `fn("${name}")`,
          kind: ts.ScriptElementKind.constElement,
          insertText: `fn("${name}")(function*(${"${1}"}){${"${0}"}})`,
          replacementSpan: span,
          isSnippet: true as const
        }
      ]),
      Option.getOrElse(() => [] as Array<LSP.CompletionEntryDefinition>)
    )

    return maybeFnName.concat([{
      name: `fn(function*(){})`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `fn(function*(${"${1}"}){${"${0}"}})`,
      replacementSpan: span,
      isSnippet: true
    }, {
      name: `fnUntraced(function*(){})`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `fnUntraced(function*(${"${1}"}){${"${0}"}})`,
      replacementSpan: span,
      isSnippet: true
    }]) satisfies Array<LSP.CompletionEntryDefinition>
  })
})
