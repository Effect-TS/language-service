import * as Array from "effect/Array"
import * as Order from "effect/Order"
import type * as ts from "typescript"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"
import { diagnostics } from "../diagnostics"

export const effectDiagnosticsComment = LSP.createCompletion({
  name: "effectDiagnosticsComment",
  apply: Nano.fn("effectDiagnosticsComment")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    // get the source text
    const sourceText = sourceFile.text

    // autocomplete the comment to disable the diagnostics
    const match = (/(\/\/|\/\*(?:\*?))\s*(@)\s*$/id).exec(sourceText.substring(0, position))
    if (match && match.indices) {
      const lastIndex = match.indices[2][0]
      const replacementSpan: ts.TextSpan = {
        start: lastIndex,
        length: Math.max(0, position - lastIndex)
      }

      const allDiagnostics = Array.sort(Object.values(diagnostics).map((diagnostic) => diagnostic.name), Order.string)
        .join(",")
      const disableSnippet = "${1|" + allDiagnostics + "|}:${2|off,warning,error,message,suggestion|}$0"

      return [{
        name: `@effect-diagnostics`,
        kind: ts.ScriptElementKind.string,
        insertText: "@effect-diagnostics " + disableSnippet,
        isSnippet: true,
        replacementSpan
      }, {
        name: `@effect-diagnostics-next-line`,
        kind: ts.ScriptElementKind.string,
        insertText: "@effect-diagnostics-next-line " + disableSnippet,
        isSnippet: true,
        replacementSpan
      }]
    }

    return []
  })
})
