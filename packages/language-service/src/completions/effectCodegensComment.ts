import * as Array from "effect/Array"
import * as Order from "effect/Order"
import type * as ts from "typescript"
import { codegens } from "../codegens"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const effectCodegensComment = LSP.createCompletion({
  name: "effectCodegensComment",
  apply: Nano.fn("effectCodegensComment")(function*(sourceFile, position) {
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

      const allCodegens = Array.sort(Object.values(codegens).map((codegen) => codegen.name), Order.String)
        .join(",")
      const enableSnippet = "${1|" + allCodegens + "|} $0"

      return [{
        name: `@effect-codegens`,
        kind: ts.ScriptElementKind.string,
        insertText: "@effect-codegens " + enableSnippet,
        isSnippet: true,
        replacementSpan
      }]
    }

    return []
  })
})
