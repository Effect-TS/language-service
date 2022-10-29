import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import { isCurryArrow } from "@effect/language-service/utils"

export default createDiagnostic({
  code: 424242,
  apply: (sourceFile) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = $(AST.collectAll(sourceFile, isCurryArrow))

      return nodes.map(node => ({
        node,
        category: ts.DiagnosticCategory.Suggestion,
        messageText: "This arrow function may be not needed."
      }))
    })
})
