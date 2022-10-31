import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"

export default createDiagnostic({
  code: 1002,
  apply: (sourceFile) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const nodes = AST.collectAll(ts)(sourceFile, ts.isCallExpression)

      return nodes.map(node => ({
        node,
        category: ts.DiagnosticCategory.Warning,
        messageText: "This arrow function may be not needed."
      }))
    })
})
