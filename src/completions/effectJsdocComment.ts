import type * as ts from "typescript"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const effectJsdocComment = LSP.createCompletion({
  name: "effectJsdocComment",
  apply: Nano.fn("effectJsdocComment")(function*(sourceFile, position) {
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

      return [{
        name: `@effect-identifier`,
        kind: ts.ScriptElementKind.string,
        insertText: "@effect-identifier",
        isSnippet: true,
        replacementSpan
      }]
    }

    return []
  })
})
