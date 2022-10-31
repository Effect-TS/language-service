import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import type { DiagnosticDefinitionMessage } from "@effect/language-service/diagnostics/definition"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import {
  findModuleImportIdentifierName,
  isCombinatorCall,
  isLiteralConstantValue
} from "@effect/language-service/utils"

export default createDiagnostic({
  code: 1002,
  apply: (sourceFile) =>
    Do($ => {
      const ts = $(T.service(AST.TypeScriptApi))

      const effectIdentifier = findModuleImportIdentifierName(ts)(sourceFile, "@effect/core/io/Effect").getOrElse(
        "Effect"
      )

      const methodsMap = {
        sync: "succeed",
        failSync: "fail",
        dieSync: "die"
      }

      let result: Chunk<DiagnosticDefinitionMessage> = Chunk.empty()

      for (const methodName of Object.keys(methodsMap)) {
        const suggestedMethodName: string = methodsMap[methodName]!

        result = result.concat(
          AST.collectAll(ts)(sourceFile, isCombinatorCall(ts)(effectIdentifier, methodName)).filter(node => {
            if (node.arguments.length !== 1) return false
            const arg = node.arguments[0]!
            if (!ts.isArrowFunction(arg)) return false
            if (!isLiteralConstantValue(ts)(arg.body)) return false
            return true
          }).map(node => ({
            node,
            category: ts.DiagnosticCategory.Warning,
            messageText: `Value is constant, instead of using ${methodName} you could use ${suggestedMethodName}.`
          }))
        )
      }

      return result
    })
})
